import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  CheckoutRequestDto,
  CheckoutRequestSchema,
  CreateCampaignDto,
  CreateCampaignSchema,
  FreezeSubscriptionDto,
  FreezeSubscriptionSchema,
  MockIpnWebhookDto,
  MockIpnWebhookSchema,
  RequestAuthContext,
  SettleDueDto,
  SettleDueSchema,
  UserRole,
} from '@vintage/shared';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { CurrentUser, Public, Roles } from '../auth/auth.decorators';
import { BillingService } from './billing.service';

const UpdateCampaignSchema = CreateCampaignSchema.partial().extend({
  isActive: z.boolean().optional(),
});

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Public()
  @Get('plans')
  listPlans() {
    return this.billingService.listPlans();
  }

  @Get('subscriptions')
  listSubscriptions(
    @CurrentUser() user: RequestAuthContext,
    @Query('userId') userId?: string,
  ) {
    return this.billingService.listSubscriptions(user, userId);
  }

  @Post('subscriptions/:id/freeze')
  freezeSubscription(
    @CurrentUser() user: RequestAuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(FreezeSubscriptionSchema))
    dto: FreezeSubscriptionDto,
  ) {
    return this.billingService.freezeSubscription(user, id, dto);
  }

  @Post('checkout')
  checkout(
    @CurrentUser() user: RequestAuthContext,
    @Body(new ZodValidationPipe(CheckoutRequestSchema))
    dto: CheckoutRequestDto,
  ) {
    return this.billingService.checkout(user, dto);
  }

  @Public()
  @Post('payments/ipn')
  @HttpCode(HttpStatus.OK)
  handleIpn(
    @Body(new ZodValidationPipe(MockIpnWebhookSchema)) dto: MockIpnWebhookDto,
  ) {
    return this.billingService.handleMockIpn(dto);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.FRONT_DESK)
  @Post('subscriptions/:id/settle-due')
  settleDue(
    @CurrentUser() user: RequestAuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SettleDueSchema)) dto: SettleDueDto,
  ) {
    return this.billingService.settleDue(user, id, dto);
  }

  @Get('transactions')
  listTransactions(
    @CurrentUser() user: RequestAuthContext,
    @Query('branchId') branchId?: string,
  ) {
    return this.billingService.listTransactions(user, branchId);
  }

  @Public()
  @Get('campaigns')
  listCampaigns() {
    return this.billingService.listCampaigns();
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Post('campaigns')
  createCampaign(
    @Body(new ZodValidationPipe(CreateCampaignSchema)) dto: CreateCampaignDto,
  ) {
    return this.billingService.createCampaign(dto);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Patch('campaigns/:id')
  updateCampaign(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateCampaignSchema))
    dto: Partial<CreateCampaignDto> & { isActive?: boolean },
  ) {
    return this.billingService.updateCampaign(id, dto);
  }
}
