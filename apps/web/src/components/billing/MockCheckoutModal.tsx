'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  CreditCard,
  ShieldCheck,
  Smartphone,
  Tag,
  WifiOff,
} from 'lucide-react';
import {
  PaymentMethod,
  type CheckoutRequestDto,
  type CheckoutResponse,
  type MockIpnWebhookDto,
} from '@vintage/shared';
import { ApiError, apiPost } from '@/lib/api';
import { formatBdt } from '@/lib/dal';
import type { MembershipPlanItem } from '@/lib/types';
import { BrandCrest } from '@/components/ui/BrandCrest';
import { Modal } from '@/components/ui/Modal';

interface MockCheckoutModalProps {
  open: boolean;
  onClose: () => void;
  plan: MembershipPlanItem | null;
  targetUserId?: string;
  targetUserName?: string;
  onSuccess?: (result: CheckoutResponse) => void;
  lightMode?: boolean;
}

type GatewayTab = 'BKASH' | 'NAGAD' | 'CARD' | 'CASH';

const GATEWAY_TABS: Array<{
  id: GatewayTab;
  label: string;
  method: PaymentMethod;
  accent: string;
  hint: string;
}> = [
  {
    id: 'BKASH',
    label: 'bKash',
    method: PaymentMethod.MOCK_BKASH,
    accent: 'border-[#E2136E] bg-[#E2136E]/15 text-[#E2136E]',
    hint: '017XXXXXXXX · Mock OTP 1234',
  },
  {
    id: 'NAGAD',
    label: 'Nagad',
    method: PaymentMethod.MOCK_NAGAD,
    accent: 'border-[#F7941D] bg-[#F7941D]/15 text-[#F59E0B]',
    hint: '018XXXXXXXX · Mock PIN 1234',
  },
  {
    id: 'CARD',
    label: 'Card',
    method: PaymentMethod.MOCK_CARD,
    accent: 'border-crimson bg-crimson/15 text-crimson',
    hint: 'Visa / Mastercard / NexusPay',
  },
  {
    id: 'CASH',
    label: 'Cash',
    method: PaymentMethod.CASH,
    accent: 'border-emerald-500 bg-emerald-500/15 text-emerald-500',
    hint: 'Reception Cash Drawer Receipt',
  },
];

export function MockCheckoutModal({
  open,
  onClose,
  plan,
  targetUserId,
  targetUserName,
  onSuccess,
  lightMode = false,
}: MockCheckoutModalProps) {
  const [activeTab, setActiveTab] = useState<GatewayTab>('BKASH');
  const [promoCode, setPromoCode] = useState('');
  const [walletAccount, setWalletAccount] = useState('+8801819887766');
  const [isPartial, setIsPartial] = useState(false);
  const [partialAmount, setPartialAmount] = useState('');
  const [submittingMode, setSubmittingMode] = useState<
    'SUCCESS' | 'FAIL' | 'BROWSER_DROP' | null
  >(null);
  const [statusLog, setStatusLog] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const selectedGateway =
    GATEWAY_TABS.find((t) => t.id === activeTab) ?? GATEWAY_TABS[0];

  const estimatedPricing = useMemo(() => {
    if (!plan) return { base: 0, discount: 0, total: 0 };
    const base = plan.priceBdt;
    const normalized = promoCode.trim().toUpperCase();
    let discount = 0;
    if (normalized === 'EID20') {
      discount = Math.round(base * 0.2);
    } else if (normalized === 'WINTER500') {
      discount = Math.min(500, base);
    }
    const total = Math.max(0, base - discount);
    return { base, discount, total };
  }, [plan, promoCode]);

  if (!plan) return null;

  const handleCheckout = async (simulateMode: 'SUCCESS' | 'FAIL' | 'BROWSER_DROP') => {
    setSubmittingMode(simulateMode);
    setStatusLog(null);

    try {
      const parsedPartial = Number(partialAmount);
      if (isPartial && (!Number.isFinite(parsedPartial) || parsedPartial <= 0)) {
        setStatusLog({
          type: 'error',
          message: 'Enter a valid partial payment amount in BDT.',
        });
        setSubmittingMode(null);
        return;
      }

      const payload: CheckoutRequestDto = {
        planId: plan.id,
        paymentMethod: selectedGateway.method as CheckoutRequestDto['paymentMethod'],
        promoCode: promoCode.trim() ? promoCode.trim().toUpperCase() : undefined,
        isPartialPayment: isPartial,
        partialPaidBdt: isPartial ? parsedPartial : undefined,
        simulateMode,
        ...(targetUserId ? { userId: targetUserId } : {}),
      };

      const checkoutRes = await apiPost<CheckoutResponse>('/api/billing/checkout', payload);

      if (simulateMode === 'FAIL') {
        setStatusLog({
          type: 'error',
          message: `Gateway simulated payment failure (${checkoutRes.invoiceNumber}). No subscription activated.`,
        });
        return;
      }

      if (simulateMode === 'BROWSER_DROP') {
        setStatusLog({
          type: 'info',
          message: `Browser dropped mid-redirect (Ref: ${checkoutRes.gatewayRef}). Firing signed Mock IPN webhook...`,
        });

        const ipnPayload: MockIpnWebhookDto = {
          gatewayRef: checkoutRes.gatewayRef,
          amountBdt: checkoutRes.amountBdt,
          status: 'CLEARED',
          signature: checkoutRes.ipnSignature,
        };

        await apiPost('/api/billing/payments/ipn', ipnPayload);

        setStatusLog({
          type: 'success',
          message: `IPN Webhook verified & reconciled! Invoice ${checkoutRes.invoiceNumber} (${formatBdt(checkoutRes.amountBdt)}) CLEARED.`,
        });
        onSuccess?.(checkoutRes);
        return;
      }

      setStatusLog({
        type: 'success',
        message: `Payment CLEARED! Invoice ${checkoutRes.invoiceNumber} · Paid ${formatBdt(checkoutRes.amountBdt)}.`,
      });
      onSuccess?.(checkoutRes);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : 'Checkout request failed. Check API server.';
      setStatusLog({ type: 'error', message: msg });
    } finally {
      setSubmittingMode(null);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Bangladesh Mock Checkout"
      subtitle={`Sandbox Gateway · ${plan.name}${targetUserName ? ` · ${targetUserName}` : ''}`}
      maxWidthClass="max-w-xl"
      lightMode={lightMode}
    >
      <div className="space-y-5">
        {/* Summary Strip */}
        <div className="overflow-hidden rounded-xl border border-steel bg-obsidian text-chalk">
          <div className="va-led-rule w-full" />
          <div className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <BrandCrest size={38} />
              <div>
                <p className="text-xs font-medium text-chrome">Selected Plan</p>
                <p className="font-display text-xl font-bold uppercase">{plan.name}</p>
              </div>
            </div>
            <div className="text-right tabular-nums">
              {estimatedPricing.discount > 0 ? (
                <p className="text-xs text-chrome line-through">
                  {formatBdt(estimatedPricing.base)}
                </p>
              ) : null}
              <p className="font-display text-2xl font-extrabold text-chalk">
                {formatBdt(estimatedPricing.total)}
              </p>
            </div>
          </div>
        </div>

        {/* Gateway Tabs */}
        <div>
          <p className="mb-2 text-xs font-bold text-chrome">
            Select Payment Channel
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {GATEWAY_TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition-colors ${
                    active
                      ? tab.accent
                      : lightMode
                        ? 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
                        : 'border-steel bg-obsidian text-chrome hover:text-chalk'
                  }`}
                >
                  {tab.id === 'CARD' ? (
                    <CreditCard className="h-4 w-4" strokeWidth={1.75} />
                  ) : tab.id === 'CASH' ? (
                    <Banknote className="h-4 w-4" strokeWidth={1.75} />
                  ) : (
                    <Smartphone className="h-4 w-4" strokeWidth={1.75} />
                  )}
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Wallet / Reference Field */}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-chrome">
              {activeTab === 'CARD'
                ? 'Mock Card Last 4 / Reference'
                : activeTab === 'CASH'
                  ? 'Reception Cashier Note'
                  : `${selectedGateway.label} Wallet Number`}
            </span>
            <input
              type="text"
              value={walletAccount}
              onChange={(e) => setWalletAccount(e.target.value)}
              placeholder={selectedGateway.hint}
              className={`min-h-12 w-full rounded-xl border px-3.5 text-sm outline-none focus:border-crimson ${
                lightMode
                  ? 'border-zinc-300 bg-white text-zinc-900'
                  : 'border-steel bg-obsidian text-chalk'
              }`}
            />
          </label>

          {/* Promo Code */}
          <div>
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-chrome">
                <Tag className="h-3.5 w-3.5 text-amber-500" strokeWidth={1.75} />
                Festival Promo Code
              </span>
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                placeholder="EID20 or WINTER500"
                className={`min-h-12 w-full rounded-xl border px-3.5 text-sm font-semibold uppercase outline-none focus:border-crimson ${
                  lightMode
                    ? 'border-zinc-300 bg-white text-zinc-900'
                    : 'border-steel bg-obsidian text-chalk'
                }`}
              />
            </label>
            <div className="mt-1.5 flex gap-2">
              {['EID20', 'WINTER500'].map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setPromoCode(code)}
                  className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-500 hover:bg-amber-500/20"
                >
                  Apply {code}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Split / Partial Payment Option */}
        <div
          className={`rounded-xl border p-3.5 ${
            lightMode ? 'border-zinc-200 bg-zinc-50' : 'border-steel bg-obsidian'
          }`}
        >
          <label className="flex min-h-[40px] cursor-pointer items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold">Split / Partial Payment (7-Day Grace)</p>
              <p className="text-xs text-chrome">
                Pay an upfront installment now and settle the remainder at reception.
              </p>
            </div>
            <input
              type="checkbox"
              checked={isPartial}
              onChange={(e) => {
                const checked = e.target.checked;
                setIsPartial(checked);
                if (checked && !partialAmount) {
                  setPartialAmount(String(Math.round(estimatedPricing.total / 2)));
                }
              }}
              className="h-5 w-5 accent-crimson"
            />
          </label>
          {isPartial ? (
            <div className="mt-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-chrome">
                  Upfront Installment (BDT)
                </span>
                <input
                  type="number"
                  min={100}
                  max={estimatedPricing.total}
                  value={partialAmount}
                  onChange={(e) => setPartialAmount(e.target.value)}
                  className={`min-h-12 w-full rounded-xl border px-3.5 text-sm font-bold outline-none focus:border-crimson ${
                    lightMode
                      ? 'border-zinc-300 bg-white text-zinc-900'
                      : 'border-steel bg-iron text-chalk'
                  }`}
                />
              </label>
            </div>
          ) : null}
        </div>

        {/* Result Banner */}
        {statusLog ? (
          <div
            role="status"
            className={`flex items-start gap-2.5 rounded-xl border p-3.5 text-xs font-medium ${
              statusLog.type === 'success'
                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-500'
                : statusLog.type === 'error'
                  ? 'border-[#FF2A3B]/50 bg-[#FF2A3B]/15 text-[#FF2A3B]'
                  : 'border-amber-500/40 bg-amber-500/15 text-amber-500'
            }`}
          >
            {statusLog.type === 'success' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
            )}
            <span>{statusLog.message}</span>
          </div>
        ) : null}

        {/* 3 Sandbox Simulation Controls */}
        <div className="space-y-2.5 pt-1">
          <button
            type="button"
            disabled={submittingMode !== null}
            onClick={() => handleCheckout('SUCCESS')}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-crimson px-4 py-3 text-sm font-bold uppercase tracking-wider text-chalk transition-colors hover:bg-crimson-hover disabled:opacity-50"
          >
            <ShieldCheck className="h-5 w-5" strokeWidth={1.75} />
            {submittingMode === 'SUCCESS' ? 'Processing...' : 'Simulate Success'}
          </button>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <button
              type="button"
              disabled={submittingMode !== null}
              onClick={() => handleCheckout('FAIL')}
              className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 ${
                lightMode
                  ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
                  : 'border-[#FF2A3B]/50 bg-[#FF2A3B]/10 text-[#FF2A3B] hover:bg-[#FF2A3B]/20'
              }`}
            >
              <AlertTriangle className="h-4 w-4" strokeWidth={1.75} />
              {submittingMode === 'FAIL' ? 'Simulating...' : 'Simulate Failed Payment'}
            </button>

            <button
              type="button"
              disabled={submittingMode !== null}
              onClick={() => handleCheckout('BROWSER_DROP')}
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-amber-500/50 bg-amber-500/15 px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-amber-500 transition-colors hover:bg-amber-500/25 disabled:opacity-50"
            >
              <WifiOff className="h-4 w-4" strokeWidth={1.75} />
              {submittingMode === 'BROWSER_DROP'
                ? 'Firing IPN...'
                : 'Simulate Browser Drop (IPN Test)'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
