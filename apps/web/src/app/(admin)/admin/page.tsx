'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Download,
  Flag,
  Megaphone,
  Printer,
  QrCode,
  Send,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
  Wrench,
} from 'lucide-react';
import {
  CampaignDiscountType,
  EquipmentStatus,
  TicketStatus,
  UserRole,
  type AdminKpisResponse,
  type AuthUserProfile,
  type ChurnRadarItem,
  type CreateCampaignDto,
  type UpdateFeatureFlagDto,
  type UpdateTicketStatusDto,
} from '@vintage/shared';
import { ApiError, apiGet, apiPatch, apiPost, getApiBaseUrl } from '@/lib/api';
import { fetchMe, formatBdt } from '@/lib/dal';
import type {
  AuditLogItem,
  BranchItem,
  CampaignItem,
  EquipmentAssetItem,
  FeatureFlagItem,
  MaintenanceTicketItem,
} from '@/lib/types';
import { PortalShell } from '@/components/layout/PortalShell';
import { Modal } from '@/components/ui/Modal';
import { SkeletonBlock } from '@/components/ui/Skeleton';
import { EquipmentStatusBadge } from '@/components/ui/StatusBadge';
import { ToastBanner, type ToastState } from '@/components/ui/ToastBanner';

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUserProfile | null>(null);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [lightMode, setLightMode] = useState(true);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastState | null>(null);

  const [kpis, setKpis] = useState<AdminKpisResponse | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [churnList, setChurnList] = useState<ChurnRadarItem[]>([]);
  const [equipmentList, setEquipmentList] = useState<EquipmentAssetItem[]>([]);
  const [tickets, setTickets] = useState<MaintenanceTicketItem[]>([]);
  const [flags, setFlags] = useState<FeatureFlagItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);

  // Festival Campaign Builder State
  const [campName, setCampName] = useState('Pohela Boishakh Iron Offer');
  const [campCode, setCampCode] = useState('BOISHAKH15');
  const [campDiscountType, setCampDiscountType] = useState<CampaignDiscountType>(
    CampaignDiscountType.PERCENTAGE,
  );
  const [campDiscountValue, setCampDiscountValue] = useState('15');
  const [campBranchId, setCampBranchId] = useState('');
  const [campSubmitting, setCampSubmitting] = useState(false);

  // Print QR Sticker Modal
  const [qrModalAsset, setQrModalAsset] = useState<EquipmentAssetItem | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const loadAdminData = useCallback(async () => {
    try {
      const [
        branchRes,
        kpiRes,
        campRes,
        churnRes,
        equipRes,
        ticketRes,
        flagRes,
        auditRes,
      ] = await Promise.all([
        apiGet<BranchItem[]>('/api/branches'),
        apiGet<AdminKpisResponse>('/api/admin/kpis'),
        apiGet<CampaignItem[]>('/api/billing/campaigns'),
        apiGet<ChurnRadarItem[]>('/api/admin/churn-radar'),
        apiGet<EquipmentAssetItem[]>('/api/facility/equipment'),
        apiGet<MaintenanceTicketItem[]>('/api/facility/tickets'),
        apiGet<FeatureFlagItem[]>('/api/admin/feature-flags'),
        apiGet<AuditLogItem[]>('/api/admin/audit-logs'),
      ]);
      setBranches(branchRes);
      setKpis(kpiRes);
      setCampaigns(campRes);
      setChurnList(churnRes);
      setEquipmentList(equipRes);
      setTickets(ticketRes);
      setFlags(flagRes);
      setAuditLogs(auditRes);
      setSelectedBranchId((prev) => prev || branchRes[0]?.id || '');
    } catch (err) {
      setToast({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Failed to load admin analytics.',
      });
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const me = await fetchMe();
      if (!me) {
        router.replace('/login');
        return;
      }
      if (me.role !== UserRole.SUPER_ADMIN) {
        router.replace('/desk');
        return;
      }
      setUser(me);
      await loadAdminData();
      setLoading(false);
    })();
  }, [router, loadAdminData]);

  useEffect(() => {
    if (!qrModalAsset || !qrCanvasRef.current) return;
    QRCode.toCanvas(
      qrCanvasRef.current,
      qrModalAsset.qrCodeToken,
      {
        width: 200,
        margin: 1,
        color: { dark: '#0A0A0C', light: '#FAFAFA' },
      },
      () => undefined,
    );
  }, [qrModalAsset]);

  const handleCreateCampaign = async (e: FormEvent) => {
    e.preventDefault();
    setCampSubmitting(true);
    try {
      const now = new Date();
      const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const payload: CreateCampaignDto = {
        name: campName.trim(),
        promoCode: campCode.trim().toUpperCase(),
        discountType: campDiscountType,
        discountValue: Number(campDiscountValue),
        branchId: campBranchId || null,
        startDate: now.toISOString(),
        endDate: nextMonth.toISOString(),
        maxRedemptions: 200,
      };
      await apiPost('/api/billing/campaigns', payload);
      setToast({ type: 'success', message: `Campaign ${payload.promoCode} published!` });
      await loadAdminData();
    } catch (err) {
      setToast({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Unable to create campaign.',
      });
    } finally {
      setCampSubmitting(false);
    }
  };

  const handleSendNudge = async (item: ChurnRadarItem) => {
    try {
      await apiPost(`/api/admin/churn-radar/${item.userId}/nudge`, {});
      setToast({
        type: 'success',
        message: `AI Check-in Nudge queued for ${item.fullName} (check /dev-inbox).`,
      });
    } catch (err) {
      setToast({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Failed to send churn nudge.',
      });
    }
  };

  const handleMoveTicket = async (
    ticket: MaintenanceTicketItem,
    nextStatus: TicketStatus,
  ) => {
    try {
      const payload: UpdateTicketStatusDto = {
        status: nextStatus,
        equipmentStatus:
          nextStatus === TicketStatus.RESOLVED
            ? EquipmentStatus.OPERATIONAL
            : nextStatus === TicketStatus.IN_PROGRESS
              ? EquipmentStatus.UNDER_MAINTENANCE
              : EquipmentStatus.OUT_OF_ORDER,
      };
      await apiPatch(`/api/facility/tickets/${ticket.id}`, payload);
      setToast({
        type: 'success',
        message: `Ticket moved to ${nextStatus} & equipment status synced.`,
      });
      await loadAdminData();
    } catch (err) {
      setToast({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Failed to update ticket.',
      });
    }
  };

  const handleToggleFlag = async (flag: FeatureFlagItem) => {
    try {
      const payload: UpdateFeatureFlagDto = { isEnabled: !flag.isEnabled };
      await apiPatch(`/api/admin/feature-flags/${encodeURIComponent(flag.key)}`, payload);
      setFlags((prev) =>
        prev.map((f) => (f.key === flag.key ? { ...f, isEnabled: !f.isEnabled } : f)),
      );
      setToast({
        type: 'info',
        message: `Flag "${flag.key}" ${!flag.isEnabled ? 'enabled' : 'disabled'}.`,
      });
    } catch (err) {
      setToast({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Unable to toggle feature flag.',
      });
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#F4F4F6] p-6">
        <div className="mx-auto max-w-6xl space-y-4">
          <SkeletonBlock lightMode className="h-24" />
          <div className="grid gap-4 md:grid-cols-4">
            <SkeletonBlock lightMode className="h-28" />
            <SkeletonBlock lightMode className="h-28" />
            <SkeletonBlock lightMode className="h-28" />
            <SkeletonBlock lightMode className="h-28" />
          </div>
        </div>
      </div>
    );
  }

  const cardSurface = lightMode
    ? 'border-zinc-200 bg-white text-zinc-900 shadow-sm'
    : 'border-steel bg-iron text-chalk shadow-xl';

  const csvExportUrl = `${getApiBaseUrl()}/api/admin/exports/transactions.csv`;

  const ticketColumns: Array<{ status: TicketStatus; label: string; accent: string }> = [
    { status: TicketStatus.OPEN, label: 'Open', accent: 'border-[#FF2A3B]/50' },
    { status: TicketStatus.IN_PROGRESS, label: 'In Progress', accent: 'border-amber-500/50' },
    { status: TicketStatus.RESOLVED, label: 'Resolved', accent: 'border-emerald-500/50' },
  ];

  return (
    <PortalShell
      user={user}
      branches={branches}
      selectedBranchId={selectedBranchId}
      onSelectBranch={setSelectedBranchId}
      lightMode={lightMode}
      onToggleLightMode={() => setLightMode((prev) => !prev)}
      title="Super Admin Command Center"
      subtitle="3-Branch Revenue, Festival Campaigns, Churn Radar & Facility Kanban"
      headerActions={
        <a
          href={csvExportUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-[48px] items-center gap-2 rounded-xl bg-crimson px-4 text-xs font-bold uppercase tracking-wider text-chalk hover:bg-crimson-hover"
        >
          <Download className="h-4 w-4" />
          Export Transactions CSV
        </a>
      }
    >
      <div className="space-y-6">
        {/* Executive KPI Strip */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            {
              label: 'Total Revenue (MTD)',
              value: kpis ? formatBdt(kpis.totalRevenueMtdBdt) : '0 BDT',
              icon: TrendingUp,
              accent: 'text-emerald-500',
            },
            {
              label: 'Active Members',
              value: String(kpis?.activeMembers ?? 0),
              icon: Users,
              accent: 'text-chalk',
            },
            {
              label: 'Overdue Members',
              value: String(kpis?.overdueMembers ?? 0),
              icon: AlertTriangle,
              accent: 'text-[#FF2A3B]',
            },
            {
              label: "Today's Footfall",
              value: String(kpis?.todayFootfall ?? 0),
              icon: Activity,
              accent: 'text-amber-500',
            },
            {
              label: 'High Churn Alerts',
              value: String(kpis?.highChurnCount ?? 0),
              icon: Sparkles,
              accent: 'text-crimson',
            },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className={`rounded-2xl border p-4 ${cardSurface}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold uppercase tracking-wider ${lightMode ? 'text-zinc-500' : 'text-chrome'}`}>
                    {stat.label}
                  </span>
                  <Icon className={`h-5 w-5 ${stat.accent}`} />
                </div>
                <p
                  className={`font-display mt-2 text-3xl font-extrabold uppercase ${
                    stat.accent === 'text-chalk' && lightMode ? 'text-zinc-900' : stat.accent
                  }`}
                >
                  {stat.value}
                </p>
              </div>
            );
          })}
        </section>

        {/* 3-Branch Revenue & Occupancy Breakdown */}
        <section className="grid gap-4 md:grid-cols-3">
          {(kpis?.branchBreakdown ?? []).map((b) => {
            const pct =
              b.maxOccupancy > 0
                ? Math.min(100, Math.round((b.currentOccupancy / b.maxOccupancy) * 100))
                : 0;
            return (
              <div key={b.branchId} className={`rounded-2xl border p-5 ${cardSurface}`}>
                <div className="flex items-center justify-between">
                  <span className="rounded bg-oxblood px-2.5 py-1 text-xs font-bold text-chalk">
                    {b.branchCode}
                  </span>
                  <span
                    className={`text-xs font-bold ${
                      b.edgeNodeOnline ? 'text-emerald-500' : 'text-amber-500'
                    }`}
                  >
                    {b.edgeNodeOnline ? '● Edge Online' : '● Edge Offline'}
                  </span>
                </div>
                <h3 className="font-display mt-3 text-2xl font-bold uppercase">{b.branchName}</h3>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className={`text-xs ${lightMode ? 'text-zinc-500' : 'text-chrome'}`}>
                    MTD Revenue
                  </span>
                  <span className="font-display text-2xl font-extrabold text-emerald-500">
                    {formatBdt(b.revenueMtdBdt)}
                  </span>
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-xs font-semibold">
                    <span>Occupancy</span>
                    <span>
                      {b.currentOccupancy} / {b.maxOccupancy} ({pct}%)
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-700/30">
                    <div
                      className="h-full rounded-full bg-crimson transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {/* Festival Campaign Builder + Live Oxblood/Crimson Mobile Banner Preview */}
        <section className="grid gap-5 lg:grid-cols-12">
          <form
            onSubmit={handleCreateCampaign}
            className={`space-y-4 rounded-2xl border p-5 lg:col-span-7 ${cardSurface}`}
          >
            <div className="flex items-center gap-2.5 border-b border-current/10 pb-3">
              <Megaphone className="h-5 w-5 text-crimson" />
              <h2 className="font-display text-2xl font-bold uppercase">
                Festival Campaign Builder
              </h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase text-chrome">
                  Campaign Title
                </span>
                <input
                  type="text"
                  required
                  value={campName}
                  onChange={(e) => setCampName(e.target.value)}
                  className={`min-h-[48px] w-full rounded-xl border px-3.5 text-sm ${
                    lightMode ? 'border-zinc-300 bg-white' : 'border-steel bg-obsidian text-chalk'
                  }`}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase text-chrome">
                  Promo Code
                </span>
                <input
                  type="text"
                  required
                  value={campCode}
                  onChange={(e) => setCampCode(e.target.value.toUpperCase())}
                  className={`min-h-[48px] w-full rounded-xl border px-3.5 font-mono text-sm uppercase ${
                    lightMode ? 'border-zinc-300 bg-white' : 'border-steel bg-obsidian text-chalk'
                  }`}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase text-chrome">
                  Discount Type
                </span>
                <select
                  value={campDiscountType}
                  onChange={(e) => setCampDiscountType(e.target.value as CampaignDiscountType)}
                  className={`min-h-[48px] w-full rounded-xl border px-3.5 text-sm ${
                    lightMode ? 'border-zinc-300 bg-white' : 'border-steel bg-obsidian text-chalk'
                  }`}
                >
                  <option value={CampaignDiscountType.PERCENTAGE}>Percentage (%)</option>
                  <option value={CampaignDiscountType.FIXED_BDT}>Fixed Amount (BDT)</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase text-chrome">
                  Discount Value
                </span>
                <input
                  type="number"
                  required
                  min={1}
                  value={campDiscountValue}
                  onChange={(e) => setCampDiscountValue(e.target.value)}
                  className={`min-h-[48px] w-full rounded-xl border px-3.5 text-sm font-bold ${
                    lightMode ? 'border-zinc-300 bg-white' : 'border-steel bg-obsidian text-chalk'
                  }`}
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase text-chrome">
                Target Branch
              </span>
              <select
                value={campBranchId}
                onChange={(e) => setCampBranchId(e.target.value)}
                className={`min-h-[48px] w-full rounded-xl border px-3.5 text-sm ${
                  lightMode ? 'border-zinc-300 bg-white' : 'border-steel bg-obsidian text-chalk'
                }`}
              >
                <option value="">All 3 Dhaka Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} • {b.name}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              disabled={campSubmitting}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-crimson text-sm font-bold uppercase tracking-wider text-chalk hover:bg-crimson-hover disabled:opacity-50"
            >
              {campSubmitting ? 'Publishing...' : 'Launch Festival Offer'}
            </button>

            {campaigns.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {campaigns.map((c) => (
                  <span
                    key={c.id}
                    className="rounded-lg border border-oxblood/50 bg-oxblood/15 px-2.5 py-1 text-xs font-semibold"
                  >
                    <strong>{c.promoCode}</strong> ({c.discountValue}
                    {c.discountType === CampaignDiscountType.PERCENTAGE ? '%' : ' BDT'})
                  </span>
                ))}
              </div>
            ) : null}
          </form>

          {/* Live Mobile Banner Preview */}
          <div className={`flex flex-col justify-between rounded-2xl border p-5 lg:col-span-5 ${cardSurface}`}>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-chrome">
                Live Mobile PWA Preview
              </p>
              <div className="mt-3 rounded-2xl border border-oxblood bg-gradient-to-br from-oxblood via-oxblood-deep to-obsidian p-5 text-chalk shadow-xl">
                <span className="inline-block rounded-full bg-crimson px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-chalk">
                  Limited Festival Drop
                </span>
                <h3 className="font-display mt-3 text-3xl font-extrabold uppercase leading-none">
                  {campName || 'Festival Iron Offer'}
                </h3>
                <p className="mt-2 text-xs text-silver">
                  Use code <strong className="font-mono text-amber-300">{campCode || 'PROMO'}</strong>{' '}
                  at bKash/Nagad checkout for{' '}
                  <strong>
                    {campDiscountValue || '0'}
                    {campDiscountType === CampaignDiscountType.PERCENTAGE ? '% OFF' : ' BDT OFF'}
                  </strong>
                  .
                </p>
                <div className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-crimson px-3.5 py-2 text-xs font-bold uppercase">
                  Claim Offer <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </div>
            </div>
            <p className="mt-4 text-xs text-chrome">
              Displayed dynamically at the top of Member PWA Home across selected branches.
            </p>
          </div>
        </section>

        {/* Proactive Churn Radar */}
        <section className={`rounded-2xl border p-5 ${cardSurface}`}>
          <div className="mb-4 flex items-center justify-between border-b border-current/10 pb-3">
            <div>
              <h2 className="font-display text-2xl font-bold uppercase">
                Proactive Churn Radar
              </h2>
              <p className={`text-xs ${lightMode ? 'text-zinc-500' : 'text-chrome'}`}>
                1-click AI check-in nudges dispatched via free Web Push / Telegram / Dev Inbox.
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {churnList.length === 0 ? (
              <p className="text-sm text-zinc-500">No high-churn members flagged today.</p>
            ) : (
              churnList.map((item) => (
                <div
                  key={item.userId}
                  className={`flex flex-col justify-between rounded-xl border p-4 ${
                    lightMode ? 'border-zinc-200 bg-zinc-50' : 'border-steel bg-obsidian/70'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display text-xl font-bold uppercase">
                        {item.fullName}
                      </span>
                      <span className="rounded-full bg-[#FF2A3B]/15 px-2.5 py-0.5 text-xs font-extrabold text-[#FF2A3B]">
                        Risk {Math.round(item.churnRiskScore * 100)}%
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-chrome">
                      {item.branchName} • {item.phone} • {item.paymentStatus}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleSendNudge(item)}
                    className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-oxblood px-3 text-xs font-bold uppercase tracking-wider text-chalk hover:bg-crimson"
                  >
                    <Send className="h-4 w-4" />
                    Send AI Check-in Nudge
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Equipment Maintenance Kanban + Print QR Sticker */}
        <section className={`space-y-4 rounded-2xl border p-5 ${cardSurface}`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-current/10 pb-3">
            <div className="flex items-center gap-2.5">
              <Wrench className="h-5 w-5 text-amber-500" />
              <h2 className="font-display text-2xl font-bold uppercase">
                Equipment Maintenance Kanban & Asset QR Stickers
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {equipmentList.map((eq) => (
                <button
                  key={eq.id}
                  type="button"
                  onClick={() => setQrModalAsset(eq)}
                  className={`flex min-h-[44px] items-center gap-2 rounded-xl border px-3 text-xs font-bold ${
                    lightMode
                      ? 'border-zinc-200 bg-zinc-50 text-zinc-800 hover:border-crimson'
                      : 'border-steel bg-obsidian text-silver hover:border-crimson'
                  }`}
                >
                  <QrCode className="h-4 w-4 text-crimson" />
                  Print QR: {eq.name}
                  <EquipmentStatusBadge status={eq.status} />
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {ticketColumns.map((col) => {
              const colTickets = tickets.filter((t) => t.status === col.status);
              return (
                <div
                  key={col.status}
                  className={`rounded-xl border-t-4 border p-4 ${col.accent} ${
                    lightMode ? 'border-zinc-200 bg-zinc-50' : 'border-steel bg-obsidian/70'
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-display text-lg font-bold uppercase">{col.label}</h3>
                    <span className="rounded-full bg-steel/40 px-2.5 py-0.5 text-xs font-bold">
                      {colTickets.length}
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {colTickets.length === 0 ? (
                      <p className="text-xs text-zinc-500">No tickets in {col.label}.</p>
                    ) : (
                      colTickets.map((t) => (
                        <div
                          key={t.id}
                          className={`rounded-xl border p-3 text-xs ${
                            lightMode ? 'border-zinc-200 bg-white' : 'border-steel bg-iron'
                          }`}
                        >
                          <p className="font-bold">{t.equipmentName ?? t.equipmentId}</p>
                          <p className="mt-1 text-chrome">{t.description}</p>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {col.status !== TicketStatus.IN_PROGRESS ? (
                              <button
                                type="button"
                                onClick={() => void handleMoveTicket(t, TicketStatus.IN_PROGRESS)}
                                className="min-h-[36px] rounded-lg bg-amber-500/20 px-2.5 py-1 text-[11px] font-bold text-amber-500 hover:bg-amber-500/30"
                              >
                                Move In Progress
                              </button>
                            ) : null}
                            {col.status !== TicketStatus.RESOLVED ? (
                              <button
                                type="button"
                                onClick={() => void handleMoveTicket(t, TicketStatus.RESOLVED)}
                                className="min-h-[36px] rounded-lg bg-emerald-500/20 px-2.5 py-1 text-[11px] font-bold text-emerald-500 hover:bg-emerald-500/30"
                              >
                                Resolve & Operational
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Feature Flags & Immutable Audit Log */}
        <section className="grid gap-5 lg:grid-cols-12">
          {/* Feature Flags */}
          <div className={`rounded-2xl border p-5 lg:col-span-5 ${cardSurface}`}>
            <div className="mb-4 flex items-center gap-2.5 border-b border-current/10 pb-3">
              <Flag className="h-5 w-5 text-crimson" />
              <h2 className="font-display text-2xl font-bold uppercase">
                Enterprise Feature Flags
              </h2>
            </div>
            <div className="space-y-3">
              {flags.map((flag) => (
                <div
                  key={flag.key}
                  className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 ${
                    lightMode ? 'border-zinc-200 bg-zinc-50' : 'border-steel bg-obsidian/70'
                  }`}
                >
                  <div>
                    <p className="font-mono text-xs font-bold">{flag.key}</p>
                    <p className="text-xs text-chrome">{flag.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleToggleFlag(flag)}
                    className={`min-h-[40px] min-w-[76px] rounded-xl px-3 text-xs font-bold uppercase transition-colors ${
                      flag.isEnabled
                        ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                        : 'bg-zinc-600 text-zinc-200 hover:bg-zinc-500'
                    }`}
                  >
                    {flag.isEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Immutable Audit Log */}
          <div className={`rounded-2xl border p-5 lg:col-span-7 ${cardSurface}`}>
            <div className="mb-4 flex items-center gap-2.5 border-b border-current/10 pb-3">
              <Shield className="h-5 w-5 text-emerald-500" />
              <h2 className="font-display text-2xl font-bold uppercase">
                Immutable Security Audit Log
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-current/10 text-[11px] uppercase text-chrome">
                    <th className="py-2 pr-3">Action</th>
                    <th className="py-2 pr-3">Actor</th>
                    <th className="py-2 pr-3">Target</th>
                    <th className="py-2">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-current/10">
                  {auditLogs.slice(0, 12).map((log) => (
                    <tr key={log.id}>
                      <td className="py-2.5 pr-3 font-mono font-bold text-crimson">
                        {log.action}
                      </td>
                      <td className="py-2.5 pr-3">{log.actorName ?? log.actorRole ?? 'System'}</td>
                      <td className="py-2.5 pr-3 font-mono text-[11px] text-chrome">
                        {log.targetType ?? '-'}
                      </td>
                      <td className="py-2.5 font-mono text-[11px] text-chrome">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {auditLogs.length === 0 ? (
                <p className="py-6 text-center text-xs text-zinc-500">
                  No audit log entries recorded yet.
                </p>
              ) : null}
            </div>
          </div>
        </section>
      </div>

      {/* Print QR Sticker Modal */}
      <Modal
        open={qrModalAsset !== null}
        onClose={() => setQrModalAsset(null)}
        title="Equipment QR Sticker"
        subtitle={qrModalAsset ? `${qrModalAsset.name} • ${qrModalAsset.zoneName}` : undefined}
        lightMode={lightMode}
      >
        {qrModalAsset ? (
          <div className="flex flex-col items-center space-y-4 text-center">
            <div className="rounded-2xl border-2 border-oxblood bg-white p-5 text-zinc-900 shadow-lg">
              <p className="font-display text-lg font-extrabold uppercase tracking-wider text-oxblood">
                Vintage Aesthetics Gym
              </p>
              <p className="text-xs font-bold text-zinc-600">{qrModalAsset.name}</p>
              <div className="my-3 flex justify-center">
                <canvas ref={qrCanvasRef} className="rounded-lg border border-zinc-200" />
              </div>
              <p className="font-mono text-xs font-bold text-zinc-800">
                {qrModalAsset.qrCodeToken}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500">
                Scan via /simulator or Member PWA to report maintenance
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-crimson text-sm font-bold uppercase tracking-wider text-chalk hover:bg-crimson-hover"
            >
              <Printer className="h-4 w-4" />
              Print Asset QR Sticker
            </button>
          </div>
        ) : null}
      </Modal>

      <ToastBanner toast={toast} onDismiss={() => setToast(null)} />
    </PortalShell>
  );
}
