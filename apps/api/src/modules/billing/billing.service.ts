import * as crypto from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AuditAction,
  BillingCycle,
  BUSINESS_RULES,
  CampaignDiscountType,
  CheckoutRequestDto,
  CheckoutResponse,
  CreateCampaignDto,
  FreezeSubscriptionDto,
  MockIpnWebhookDto,
  NotificationTriggerType,
  PaymentStatus,
  RequestAuthContext,
  SettleDueDto,
  TransactionStatus,
  TransactionType,
  UserRole,
  UserStatus,
} from '@vintage/shared';
import { CryptoService } from '../../common/crypto.service';
import { SYSTEM_RLS_CONTEXT, withSystemRls, withTxRls } from '../../common/rls-utils';
import { PrismaService } from '../../prisma/prisma.service';
import { withRlsContext } from '../../prisma/rls.helper';
import { NotificationsService } from '../notifications/notifications.service';

interface PendingCheckoutMeta {
  userId: string;
  planId: string;
  totalAmountBdt: number;
  paidAmountBdt: number;
  dueAmountBdt: number;
}

@Injectable()
export class BillingService {
  private readonly pendingCheckouts = new Map<string, PendingCheckoutMeta>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly notifications: NotificationsService,
  ) {}

  listPlans() {
    return this.prisma.membershipPlan.findMany({
      where: { isActive: true },
      orderBy: { priceBdt: 'asc' },
    });
  }

  async listSubscriptions(actor: RequestAuthContext, userId?: string) {
    if (actor.role === UserRole.MEMBER) {
      return withRlsContext(this.prisma, actor, (tx) =>
        tx.subscription.findMany({
          where: {
            OR: [
              { userId: actor.userId },
              { user: { primaryPayerId: actor.userId } },
            ],
            ...(userId ? { userId } : {}),
          },
          include: {
            plan: true,
            user: { select: { id: true, fullName: true, phone: true } },
          },
          orderBy: { startDate: 'desc' },
        }),
      );
    }

    return withRlsContext(this.prisma, actor, (tx) =>
      tx.subscription.findMany({
        where: {
          ...(userId ? { userId } : {}),
          ...(actor.role !== UserRole.SUPER_ADMIN
            ? { user: { homeBranchId: actor.branchId } }
            : {}),
        },
        include: {
          plan: true,
          user: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              homeBranchId: true,
            },
          },
        },
        orderBy: { startDate: 'desc' },
        take: 100,
      }),
    );
  }

  async freezeSubscription(
    actor: RequestAuthContext,
    subscriptionId: string,
    dto: FreezeSubscriptionDto,
  ) {
    const sub = await withSystemRls(this.prisma, (tx) =>
      tx.subscription.findUnique({
        where: { id: subscriptionId },
        include: {
          user: {
            select: { id: true, homeBranchId: true, primaryPayerId: true },
          },
        },
      }),
    );

    if (!sub) {
      throw new NotFoundException('Subscription not found');
    }

    if (actor.role === UserRole.MEMBER) {
      if (
        sub.userId !== actor.userId &&
        sub.user.primaryPayerId !== actor.userId
      ) {
        throw new ForbiddenException('Cannot freeze another member subscription');
      }
    } else if (
      actor.role !== UserRole.SUPER_ADMIN &&
      sub.user.homeBranchId !== actor.branchId
    ) {
      throw new ForbiddenException('Cross-branch freeze forbidden');
    }

    if (
      sub.paymentStatus !== PaymentStatus.PAID &&
      sub.paymentStatus !== PaymentStatus.PARTIAL
    ) {
      throw new BadRequestException(
        `Cannot freeze subscription in status ${sub.paymentStatus}`,
      );
    }

    const now = new Date();
    const frozenUntil = new Date(now.getTime() + dto.days * 86_400_000);
    const extendedEnd = new Date(sub.endDate.getTime() + dto.days * 86_400_000);

    return withSystemRls(this.prisma, async (tx) => {
      const updated = await tx.subscription.update({
        where: { id: sub.id },
        data: {
          paymentStatus: PaymentStatus.FROZEN,
          frozenFrom: now,
          frozenUntil,
          endDate: extendedEnd,
          syncVersion: { increment: 1 },
        },
      });

      await tx.user.update({
        where: { id: sub.userId },
        data: { status: UserStatus.FROZEN },
      });

      return updated;
    });
  }

  async checkout(
    actor: RequestAuthContext,
    dto: CheckoutRequestDto,
  ): Promise<CheckoutResponse> {
    const targetUserId = dto.userId ?? actor.userId;

    const targetUser = await withSystemRls(this.prisma, (tx) =>
      tx.user.findUnique({
        where: { id: targetUserId },
        select: {
          id: true,
          fullName: true,
          homeBranchId: true,
          primaryPayerId: true,
        },
      }),
    );

    if (!targetUser) {
      throw new NotFoundException('Target member not found');
    }

    if (actor.role === UserRole.MEMBER) {
      if (
        targetUser.id !== actor.userId &&
        targetUser.primaryPayerId !== actor.userId
      ) {
        throw new ForbiddenException(
          'Members can only checkout for themselves or family dependents',
        );
      }
    } else if (
      actor.role !== UserRole.SUPER_ADMIN &&
      targetUser.homeBranchId !== actor.branchId
    ) {
      throw new ForbiddenException('Cross-branch checkout forbidden');
    }

    const now = new Date();

    const result = await withTxRls(
      this.prisma,
      async (tx) => {
        const plan = await tx.membershipPlan.findUnique({
          where: { id: dto.planId },
        });
        if (!plan || !plan.isActive) {
          throw new NotFoundException('Membership plan not found or inactive');
        }

        const basePrice = plan.priceBdt;
        const familyDiscount = targetUser.primaryPayerId
          ? (basePrice * BUSINESS_RULES.FAMILY_DISCOUNT_PCT) / 100
          : 0;
        const afterFamily = Math.max(0, basePrice - familyDiscount);

        let promoDiscount = 0;
        let campaignId: string | null = null;

        if (dto.promoCode) {
          const normalizedCode = this.cryptoService.normalizePromoCode(
            dto.promoCode,
          );
          const campaign = await tx.campaign.findUnique({
            where: { promoCode: normalizedCode },
          });

          if (
            !campaign ||
            !campaign.isActive ||
            campaign.startDate > now ||
            campaign.endDate < now ||
            (campaign.branchId !== null &&
              campaign.branchId !== targetUser.homeBranchId)
          ) {
            throw new BadRequestException('Promo code is invalid or expired');
          }

          if (campaign.maxRedemptions !== null) {
            const updated = await tx.campaign.updateMany({
              where: {
                id: campaign.id,
                redemptionCount: { lt: campaign.maxRedemptions },
              },
              data: { redemptionCount: { increment: 1 } },
            });
            if (updated.count === 0) {
              throw new ConflictException(
                'Promo code redemption limit exhausted',
              );
            }
          } else {
            await tx.campaign.update({
              where: { id: campaign.id },
              data: { redemptionCount: { increment: 1 } },
            });
          }

          campaignId = campaign.id;
          promoDiscount =
            campaign.discountType === CampaignDiscountType.PERCENTAGE
              ? (afterFamily * campaign.discountValue) / 100
              : campaign.discountValue;
        }

        const totalPayableBdt = Math.max(
          0,
          Math.round(afterFamily - promoDiscount),
        );
        const discountAppliedBdt = Math.max(0, Math.round(basePrice - totalPayableBdt));

        let chargeAmountBdt = totalPayableBdt;
        let dueAmountBdt = 0;

        if (dto.isPartialPayment && dto.partialPaidBdt !== undefined) {
          if (dto.partialPaidBdt >= totalPayableBdt) {
            chargeAmountBdt = totalPayableBdt;
            dueAmountBdt = 0;
          } else {
            chargeAmountBdt = Math.round(dto.partialPaidBdt);
            dueAmountBdt = totalPayableBdt - chargeAmountBdt;
          }
        }

        const gatewayRef = `GW-${crypto.randomUUID().slice(0, 12).toUpperCase()}`;
        const invoiceNumber = `INV-${Date.now()}-${crypto.randomInt(100, 999)}`;
        const ipnSignature = this.cryptoService.signIpnPayload(
          gatewayRef,
          chargeAmountBdt,
          'CLEARED',
        );

        let txStatus: string = TransactionStatus.CLEARED;
        if (dto.simulateMode === 'FAIL') {
          txStatus = TransactionStatus.FAILED;
        } else if (dto.simulateMode === 'BROWSER_DROP') {
          txStatus = TransactionStatus.PENDING;
        }

        const transaction = await tx.transaction.create({
          data: {
            invoiceNumber,
            userId: targetUser.id,
            campaignId,
            type:
              plan.billingCycle === BillingCycle.SESSION_PACK
                ? TransactionType.PT_PACKAGE
                : TransactionType.MEMBERSHIP,
            paymentMethod: dto.paymentMethod,
            amountBdt: chargeAmountBdt,
            discountAppliedBdt,
            gatewayRef,
            status: txStatus,
            collectedByStaffId:
              actor.role !== UserRole.MEMBER ? actor.userId : null,
          },
        });

        let subscriptionId: string | undefined;

        if (dto.simulateMode === 'SUCCESS') {
          const durationDays = plan.durationDays ?? 30;
          const endDate = new Date(now.getTime() + durationDays * 86_400_000);
          const sub = await tx.subscription.create({
            data: {
              userId: targetUser.id,
              planId: plan.id,
              startDate: now,
              endDate,
              nextBillingDate: endDate,
              paymentStatus:
                dueAmountBdt > 0 ? PaymentStatus.PARTIAL : PaymentStatus.PAID,
              totalAmountBdt: totalPayableBdt,
              paidAmountBdt: chargeAmountBdt,
              dueAmountBdt,
              remainingCredits: plan.sessionCredits ?? 0,
            },
          });
          subscriptionId = sub.id;

          await tx.user.update({
            where: { id: targetUser.id },
            data: { status: UserStatus.ACTIVE },
          });
        } else if (dto.simulateMode === 'BROWSER_DROP') {
          this.pendingCheckouts.set(gatewayRef, {
            userId: targetUser.id,
            planId: plan.id,
            totalAmountBdt: totalPayableBdt,
            paidAmountBdt: chargeAmountBdt,
            dueAmountBdt,
          });
        }

        return {
          planName: plan.name,
          response: {
            transactionId: transaction.id,
            invoiceNumber: transaction.invoiceNumber,
            gatewayRef,
            amountBdt: chargeAmountBdt,
            discountAppliedBdt,
            status: txStatus,
            ipnSignature,
            subscriptionId,
          } satisfies CheckoutResponse,
        };
      },
      { ...SYSTEM_RLS_CONTEXT, branchId: targetUser.homeBranchId },
    );

    if (dto.simulateMode === 'SUCCESS') {
      await this.notifications.sendNotification({
        userId: targetUser.id,
        triggerType: NotificationTriggerType.PAYMENT_RECEIPT,
        subject: `Payment Receipt ${result.response.invoiceNumber}`,
        payload: `Thank you ${targetUser.fullName}! Paid ${result.response.amountBdt} BDT via ${dto.paymentMethod} for ${result.planName}. Ref: ${result.response.gatewayRef}.`,
      });
    }

    return result.response;
  }

  async handleMockIpn(dto: MockIpnWebhookDto) {
    const validSig = this.cryptoService.verifyIpnSignature(
      dto.gatewayRef,
      dto.amountBdt,
      dto.status,
      dto.signature,
    );
    if (!validSig) {
      throw new UnauthorizedException('Invalid IPN signature');
    }

    const existingTx = await withSystemRls(this.prisma, (tx) =>
      tx.transaction.findFirst({
        where: { gatewayRef: dto.gatewayRef },
        include: { user: { select: { id: true, fullName: true } } },
      }),
    );

    if (!existingTx) {
      throw new NotFoundException('Transaction for gatewayRef not found');
    }

    if (Math.abs(existingTx.amountBdt - dto.amountBdt) > 0.01) {
      throw new BadRequestException('IPN amount does not match transaction');
    }

    if (existingTx.status === TransactionStatus.CLEARED) {
      return {
        alreadyProcessed: true,
        transactionId: existingTx.id,
        status: existingTx.status,
      };
    }

    const activation = await withTxRls(this.prisma, async (tx) => {
      const updated = await tx.transaction.updateMany({
        where: { id: existingTx.id, status: TransactionStatus.PENDING },
        data: { status: dto.status },
      });

      if (updated.count === 0) {
        return { alreadyProcessed: true, subscriptionId: undefined };
      }

      if (dto.status !== 'CLEARED') {
        return { alreadyProcessed: false, subscriptionId: undefined };
      }

      const meta = this.pendingCheckouts.get(dto.gatewayRef);
      this.pendingCheckouts.delete(dto.gatewayRef);

      let plan = meta
        ? await tx.membershipPlan.findUnique({ where: { id: meta.planId } })
        : null;

      if (!plan) {
        const expectedOriginal =
          existingTx.amountBdt + existingTx.discountAppliedBdt;
        plan = await tx.membershipPlan.findFirst({
          where: { isActive: true, priceBdt: expectedOriginal },
        });
      }

      if (!plan) {
        plan = await tx.membershipPlan.findFirst({
          where: { isActive: true },
          orderBy: { priceBdt: 'asc' },
        });
      }

      if (!plan) {
        return { alreadyProcessed: false, subscriptionId: undefined };
      }

      const now = new Date();
      const endDate = new Date(
        now.getTime() + (plan.durationDays ?? 30) * 86_400_000,
      );

      const dueAmountBdt = meta?.dueAmountBdt ?? 0;
      const totalAmountBdt = meta?.totalAmountBdt ?? existingTx.amountBdt;

      const sub = await tx.subscription.create({
        data: {
          userId: existingTx.userId,
          planId: plan.id,
          startDate: now,
          endDate,
          nextBillingDate: endDate,
          paymentStatus:
            dueAmountBdt > 0 ? PaymentStatus.PARTIAL : PaymentStatus.PAID,
          totalAmountBdt,
          paidAmountBdt: existingTx.amountBdt,
          dueAmountBdt,
          remainingCredits: plan.sessionCredits ?? 0,
        },
      });

      await tx.user.update({
        where: { id: existingTx.userId },
        data: { status: UserStatus.ACTIVE },
      });

      return {
        alreadyProcessed: false,
        subscriptionId: sub.id,
        planName: plan.name,
      };
    });

    if (!activation.alreadyProcessed && dto.status === 'CLEARED') {
      await this.notifications.sendNotification({
        userId: existingTx.userId,
        triggerType: NotificationTriggerType.PAYMENT_RECEIPT,
        subject: `IPN Payment Cleared — ${existingTx.invoiceNumber}`,
        payload: `Payment of ${existingTx.amountBdt} BDT cleared via IPN for ${activation.planName ?? 'Membership'}. Ref: ${dto.gatewayRef}.`,
      });
    }

    return {
      alreadyProcessed: activation.alreadyProcessed,
      transactionId: existingTx.id,
      status: dto.status,
      subscriptionId: activation.subscriptionId,
    };
  }

  async settleDue(
    actor: RequestAuthContext,
    subscriptionId: string,
    dto: SettleDueDto,
  ) {
    const sub = await withSystemRls(this.prisma, (tx) =>
      tx.subscription.findUnique({
        where: { id: subscriptionId },
        include: {
          user: { select: { id: true, fullName: true, homeBranchId: true } },
          plan: true,
        },
      }),
    );

    if (!sub) {
      throw new NotFoundException('Subscription not found');
    }

    if (
      actor.role !== UserRole.SUPER_ADMIN &&
      sub.user.homeBranchId !== actor.branchId
    ) {
      throw new ForbiddenException('Cross-branch due settlement forbidden');
    }

    if (sub.dueAmountBdt <= 0) {
      throw new BadRequestException('Subscription has no outstanding dues');
    }

    const payAmount = Math.min(
      sub.dueAmountBdt,
      dto.amountBdt ?? sub.dueAmountBdt,
    );
    const newPaid = sub.paidAmountBdt + payAmount;
    const newDue = Math.max(0, sub.dueAmountBdt - payAmount);
    const nextStatus =
      newDue <= 0 ? PaymentStatus.PAID : PaymentStatus.PARTIAL;

    const settled = await withTxRls(this.prisma, async (tx) => {
      const updatedSub = await tx.subscription.update({
        where: { id: sub.id },
        data: {
          paidAmountBdt: newPaid,
          dueAmountBdt: newDue,
          paymentStatus: nextStatus,
          syncVersion: { increment: 1 },
        },
      });

      const invoiceNumber = `INV-DUE-${Date.now()}-${crypto.randomInt(100, 999)}`;
      const transaction = await tx.transaction.create({
        data: {
          invoiceNumber,
          userId: sub.userId,
          type: TransactionType.PARTIAL_DUE_SETTLEMENT,
          paymentMethod: dto.paymentMethod,
          amountBdt: payAmount,
          discountAppliedBdt: 0,
          gatewayRef: `DUE-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
          status: TransactionStatus.CLEARED,
          collectedByStaffId: actor.userId,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          branchId: sub.user.homeBranchId,
          action: AuditAction.PARTIAL_DUE_PAID,
          entityType: 'Subscription',
          entityId: sub.id,
          metadataJson: JSON.stringify({
            memberId: sub.userId,
            settledAmountBdt: payAmount,
            remainingDueBdt: newDue,
            transactionId: transaction.id,
          }),
        },
      });

      return { subscription: updatedSub, transaction };
    }, actor);

    await this.notifications.sendNotification({
      userId: sub.userId,
      triggerType: NotificationTriggerType.PAYMENT_RECEIPT,
      subject: `Due Settled — ${settled.transaction.invoiceNumber}`,
      payload: `Received ${payAmount} BDT towards ${sub.plan.name}. Remaining due: ${newDue} BDT.`,
    });

    return settled;
  }

  async listTransactions(actor: RequestAuthContext, branchId?: string) {
    if (
      actor.role !== UserRole.SUPER_ADMIN &&
      branchId &&
      branchId !== actor.branchId
    ) {
      throw new ForbiddenException('Cross-branch transaction read forbidden');
    }

    if (actor.role === UserRole.MEMBER) {
      return withRlsContext(this.prisma, actor, (tx) =>
        tx.transaction.findMany({
          where: { userId: actor.userId },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
      );
    }

    const effectiveBranch =
      actor.role === UserRole.SUPER_ADMIN ? branchId : actor.branchId;

    return withRlsContext(this.prisma, actor, (tx) =>
      tx.transaction.findMany({
        where: effectiveBranch
          ? { user: { homeBranchId: effectiveBranch } }
          : {},
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              homeBranchId: true,
            },
          },
          campaign: { select: { promoCode: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    );
  }

  listCampaigns() {
    return this.prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCampaign(dto: CreateCampaignDto) {
    const normalizedCode = this.cryptoService.normalizePromoCode(dto.promoCode);
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate <= startDate) {
      throw new BadRequestException('Campaign endDate must be after startDate');
    }

    return this.prisma.campaign.create({
      data: {
        name: dto.name.trim(),
        promoCode: normalizedCode,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        branchId: dto.branchId ?? null,
        startDate,
        endDate,
        maxRedemptions: dto.maxRedemptions ?? null,
      },
    });
  }

  async updateCampaign(id: string, dto: Partial<CreateCampaignDto> & { isActive?: boolean }) {
    const existing = await this.prisma.campaign.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Campaign not found');
    }

    return this.prisma.campaign.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.promoCode !== undefined
          ? { promoCode: this.cryptoService.normalizePromoCode(dto.promoCode) }
          : {}),
        ...(dto.discountType !== undefined
          ? { discountType: dto.discountType }
          : {}),
        ...(dto.discountValue !== undefined
          ? { discountValue: dto.discountValue }
          : {}),
        ...(dto.branchId !== undefined ? { branchId: dto.branchId } : {}),
        ...(dto.startDate !== undefined
          ? { startDate: new Date(dto.startDate) }
          : {}),
        ...(dto.endDate !== undefined
          ? { endDate: new Date(dto.endDate) }
          : {}),
        ...(dto.maxRedemptions !== undefined
          ? { maxRedemptions: dto.maxRedemptions }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }
}
