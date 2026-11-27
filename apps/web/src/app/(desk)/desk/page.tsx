'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  CreditCard,
  Lock,
  RefreshCw,
  Search,
  ShieldAlert,
  UserCheck,
  UserPlus,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  BUSINESS_RULES,
  EntryStatus,
  PaymentMethod,
  SOCKET_EVENTS,
  UserRole,
  type AccessVerifyResult,
  type AuthUserProfile,
  type ManualOverrideDto,
  type MemberQuickProfile,
  type OnboardMemberDto,
  type ReplaceCardDto,
  type SettleDueDto,
} from '@vintage/shared';
import { ApiError, apiGet, apiPost } from '@/lib/api';
import { fetchMe, formatBdt } from '@/lib/dal';
import { getRealtimeSocket } from '@/lib/socket';
import type {
  AttendanceLogItem,
  BranchItem,
  MembershipPlanItem,
  UserSummaryItem,
} from '@/lib/types';
import { PortalShell } from '@/components/layout/PortalShell';
import { Modal } from '@/components/ui/Modal';
import { SkeletonBlock } from '@/components/ui/Skeleton';
import { EntryStatusBadge, PaymentStatusBadge } from '@/components/ui/StatusBadge';
import { ToastBanner, type ToastState } from '@/components/ui/ToastBanner';
import { MockCheckoutModal } from '@/components/billing/MockCheckoutModal';

function playDenialBeep() {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(520, ctx.currentTime);
    osc.frequency.setValueAtTime(380, ctx.currentTime + 0.14);
    gain.gain.setValueAtTime(0.14, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.34);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // Browser autoplay policy may block audio before interaction
  }
}

function isDeniedStatus(status: EntryStatus): boolean {
  return (
    status === EntryStatus.DENIED_UNPAID ||
    status === EntryStatus.DENIED_EXPIRED ||
    status === EntryStatus.DENIED_FROZEN ||
    status === EntryStatus.DENIED_WRONG_BRANCH
  );
}

export default function DeskPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUserProfile | null>(null);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [plans, setPlans] = useState<MembershipPlanItem[]>([]);
  const [lightMode, setLightMode] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  const [logs, setLogs] = useState<AttendanceLogItem[]>([]);
  const [members, setMembers] = useState<UserSummaryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<MemberQuickProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [toast, setToast] = useState<ToastState | null>(null);

  // Modals
  const [collectOpen, setCollectOpen] = useState(false);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleMethod, setSettleMethod] = useState<SettleDueDto['paymentMethod']>(
    PaymentMethod.CASH,
  );
  const [checkoutPlanModalOpen, setCheckoutPlanModalOpen] = useState(false);

  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState<ManualOverrideDto['reason']>(
    'Promised to pay tomorrow',
  );
  const [overrideNotes, setOverrideNotes] = useState('');

  const [replaceOpen, setReplaceOpen] = useState(false);
  const [newCardUid, setNewCardUid] = useState('');
  const [replaceReason, setReplaceReason] = useState<'LOST' | 'DAMAGED'>('LOST');
  const [replaceMethod, setReplaceMethod] = useState<ReplaceCardDto['paymentMethod']>(
    PaymentMethod.CASH,
  );

  const [walkInOpen, setWalkInOpen] = useState(false);
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('+8801');
  const [walkInEmail, setWalkInEmail] = useState('');
  const [walkInEmergency, setWalkInEmergency] = useState('');
  const [walkInCardUid, setWalkInCardUid] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadQuickProfile = useCallback(async (userId: string) => {
    setProfileLoading(true);
    try {
      const profile = await apiGet<MemberQuickProfile>(`/api/users/${userId}/quick-profile`);
      setSelectedProfile(profile);
    } catch (err) {
      setToast({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Unable to load member quick-profile.',
      });
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const loadWorkspaceData = useCallback(async (branchId: string) => {
    try {
      const [accessLogs, userList, planList] = await Promise.all([
        apiGet<AttendanceLogItem[]>(`/api/access/logs?branchId=${encodeURIComponent(branchId)}`),
        apiGet<UserSummaryItem[]>(`/api/users?branchId=${encodeURIComponent(branchId)}`),
        apiGet<MembershipPlanItem[]>('/api/billing/plans'),
      ]);
      setLogs(accessLogs);
      setMembers(userList.filter((u) => u.role === UserRole.MEMBER));
      setPlans(planList);
    } catch (err) {
      setToast({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Failed to load front-desk records.',
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
      if (
        me.role !== UserRole.FRONT_DESK &&
        me.role !== UserRole.BRANCH_MANAGER &&
        me.role !== UserRole.SUPER_ADMIN
      ) {
        setToast({ type: 'error', message: 'Front-Desk or Admin access required.' });
        router.replace('/login');
        return;
      }

      setUser(me);
      try {
        const branchList = await apiGet<BranchItem[]>('/api/branches');
        setBranches(branchList);
        const initialBranch = me.homeBranchId || branchList[0]?.id || '';
        setSelectedBranchId(initialBranch);
        if (initialBranch) {
          await loadWorkspaceData(initialBranch);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [router, loadWorkspaceData]);

  // Socket.IO live turnstile & occupancy feed
  useEffect(() => {
    if (!user) return;
    const socket = getRealtimeSocket();

    const onAccessEvent = (event: AccessVerifyResult) => {
      if (selectedBranchId && event.branchId !== selectedBranchId && user.role !== UserRole.SUPER_ADMIN) {
        return;
      }
      const nextLog: AttendanceLogItem = {
        id: event.attendanceLogId,
        branchId: event.branchId,
        userId: event.userId ?? null,
        memberName: event.memberName ?? 'Unknown Card',
        entryStatus: event.entryStatus,
        reason: event.reason,
        planName: event.planName ?? null,
        dueAmountBdt: event.dueAmountBdt ?? null,
        scannedAt: event.scannedAt,
      };
      setLogs((prev) => [nextLog, ...prev.filter((l) => l.id !== nextLog.id)].slice(0, 60));

      if (isDeniedStatus(event.entryStatus)) {
        if (soundEnabled) playDenialBeep();
        if (event.userId) {
          void loadQuickProfile(event.userId);
        }
      }
    };

    const onOccupancyUpdate = (payload: { branchId: string; currentOccupancy: number; edgeNodeOnline?: boolean }) => {
      setBranches((prev) =>
        prev.map((b) =>
          b.id === payload.branchId
            ? {
                ...b,
                currentOccupancy: payload.currentOccupancy,
                ...(typeof payload.edgeNodeOnline === 'boolean'
                  ? { edgeNodeOnline: payload.edgeNodeOnline }
                  : {}),
              }
            : b,
        ),
      );
    };

    socket.on(SOCKET_EVENTS.ACCESS_EVENT, onAccessEvent);
    socket.on(SOCKET_EVENTS.OCCUPANCY_UPDATE, onOccupancyUpdate);

    return () => {
      socket.off(SOCKET_EVENTS.ACCESS_EVENT, onAccessEvent);
      socket.off(SOCKET_EVENTS.OCCUPANCY_UPDATE, onOccupancyUpdate);
    };
  }, [user, selectedBranchId, soundEnabled, loadQuickProfile]);

  const activeBranch = useMemo(
    () => branches.find((b) => b.id === selectedBranchId) ?? branches[0] ?? null,
    [branches, selectedBranchId],
  );

  // Pin denied entries at the top so reception never misses a red turnstile alert
  const orderedLogs = useMemo(() => {
    const denied = logs.filter((l) => isDeniedStatus(l.entryStatus));
    const granted = logs.filter((l) => !isDeniedStatus(l.entryStatus));
    return [...denied, ...granted];
  }, [logs]);

  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return members.slice(0, 8);
    return members
      .filter(
        (m) =>
          m.fullName.toLowerCase().includes(q) ||
          m.phone.toLowerCase().includes(q) ||
          (m.email && m.email.toLowerCase().includes(q)) ||
          (m.activeCardUid && m.activeCardUid.toLowerCase().includes(q)),
      )
      .slice(0, 10);
  }, [members, searchQuery]);

  const handleBranchSwitch = async (branchId: string) => {
    setSelectedBranchId(branchId);
    await loadWorkspaceData(branchId);
  };

  const handleSettleDue = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProfile?.subscription) return;
    setSubmitting(true);
    try {
      const payload: SettleDueDto = {
        paymentMethod: settleMethod,
        ...(Number(settleAmount) > 0 ? { amountBdt: Number(settleAmount) } : {}),
      };
      await apiPost(
        `/api/billing/subscriptions/${selectedProfile.subscription.id}/settle-due`,
        payload,
      );
      setToast({ type: 'success', message: 'Due balance settled & ledger updated.' });
      setCollectOpen(false);
      await loadQuickProfile(selectedProfile.id);
    } catch (err) {
      setToast({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Unable to settle due balance.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualOverride = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProfile || !activeBranch) return;
    if (overrideNotes.trim().length < BUSINESS_RULES.MIN_OVERRIDE_NOTE_LENGTH) {
      setToast({
        type: 'error',
        message: `Override note must be at least ${BUSINESS_RULES.MIN_OVERRIDE_NOTE_LENGTH} characters.`,
      });
      return;
    }

    setSubmitting(true);
    try {
      const payload: ManualOverrideDto = {
        userId: selectedProfile.id,
        branchId: activeBranch.id,
        reason: overrideReason,
        notes: overrideNotes.trim(),
      };
      await apiPost('/api/access/override', payload);
      setToast({
        type: 'success',
        message: `Gate unlocked via Manual Override for ${selectedProfile.fullName}. Audit log recorded.`,
      });
      setOverrideOpen(false);
      setOverrideNotes('');
      await Promise.all([
        loadQuickProfile(selectedProfile.id),
        loadWorkspaceData(activeBranch.id),
      ]);
    } catch (err) {
      setToast({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Manual override rejected.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReplaceCard = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProfile) return;
    setSubmitting(true);
    try {
      const payload: ReplaceCardDto = {
        userId: selectedProfile.id,
        newCardUid: newCardUid.trim().toUpperCase(),
        paymentMethod: replaceMethod,
        lostOrDamagedReason: replaceReason,
      };
      await apiPost('/api/access/cards/replace', payload);
      setToast({
        type: 'success',
        message: `Card replaced (${BUSINESS_RULES.CARD_REPLACEMENT_FEE_BDT} BDT billed). New UID ${payload.newCardUid} active.`,
      });
      setReplaceOpen(false);
      setNewCardUid('');
      await loadQuickProfile(selectedProfile.id);
    } catch (err) {
      setToast({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Card replacement failed.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleWalkInOnboard = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeBranch) return;
    setSubmitting(true);
    try {
      const payload: OnboardMemberDto = {
        fullName: walkInName.trim(),
        phone: walkInPhone.trim(),
        email: walkInEmail.trim() ? walkInEmail.trim() : undefined,
        emergencyContact: walkInEmergency.trim() || undefined,
        homeBranchId: activeBranch.id,
        cardUid: walkInCardUid.trim() ? walkInCardUid.trim().toUpperCase() : undefined,
      };
      const created = await apiPost<{ id: string }>('/api/users/onboard', payload);
      setToast({ type: 'success', message: `Walk-in member ${walkInName} onboarded!` });
      setWalkInOpen(false);
      setWalkInName('');
      setWalkInPhone('+8801');
      setWalkInEmail('');
      setWalkInEmergency('');
      setWalkInCardUid('');
      await loadWorkspaceData(activeBranch.id);
      if (created?.id) {
        await loadQuickProfile(created.id);
      }
    } catch (err) {
      setToast({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Walk-in onboarding failed.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#F4F4F6] p-6">
        <div className="mx-auto max-w-6xl space-y-4">
          <SkeletonBlock lightMode className="h-16" />
          <div className="grid gap-4 lg:grid-cols-12">
            <SkeletonBlock lightMode className="h-[460px] lg:col-span-8" />
            <SkeletonBlock lightMode className="h-[460px] lg:col-span-4" />
          </div>
        </div>
      </div>
    );
  }

  const cardSurface = lightMode
    ? 'border-zinc-200 bg-white text-zinc-900 shadow-sm'
    : 'border-steel bg-iron text-chalk shadow-xl';

  return (
    <PortalShell
      user={user}
      branches={branches}
      selectedBranchId={selectedBranchId}
      onSelectBranch={handleBranchSwitch}
      lightMode={lightMode}
      onToggleLightMode={() => setLightMode((prev) => !prev)}
      title="Front-Desk Live Access"
      subtitle="Real-time turnstile verification, override audit, and due collection"
      headerActions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSoundEnabled((s) => !s)}
            aria-label={soundEnabled ? 'Mute denial chime' : 'Enable denial chime'}
            className={`flex h-12 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold ${
              lightMode
                ? 'border-zinc-200 bg-zinc-50 text-zinc-700'
                : 'border-steel bg-obsidian text-chrome'
            }`}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4 text-crimson" /> : <VolumeX className="h-4 w-4" />}
            Chime
          </button>
          <button
            type="button"
            onClick={() => setWalkInOpen(true)}
            className="flex min-h-[48px] items-center gap-2 rounded-xl bg-crimson px-4 text-xs font-bold uppercase tracking-wider text-chalk hover:bg-crimson-hover"
          >
            <UserPlus className="h-4 w-4" />
            Quick Walk-In Onboard
          </button>
        </div>
      }
    >
      {/* Quick Search Member Bar */}
      <div className={`mb-5 rounded-2xl border p-4 ${cardSurface}`}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-3.5 left-3.5 h-5 w-5 text-zinc-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Quick-search member by name, phone, email, or RFID UID (e.g. Tariq, VA-RFID-8841)..."
              className={`min-h-[48px] w-full rounded-xl border pr-4 pl-11 text-sm outline-none focus:border-crimson ${
                lightMode
                  ? 'border-zinc-300 bg-zinc-50 text-zinc-900'
                  : 'border-steel bg-obsidian text-chalk'
              }`}
            />
          </div>
          <button
            type="button"
            onClick={() => activeBranch && void loadWorkspaceData(activeBranch.id)}
            className={`flex min-h-[48px] items-center justify-center gap-2 rounded-xl border px-4 text-xs font-bold uppercase tracking-wider ${
              lightMode
                ? 'border-zinc-200 bg-zinc-50 text-zinc-800 hover:bg-zinc-100'
                : 'border-steel bg-obsidian text-silver hover:text-chalk'
            }`}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Feed
          </button>
        </div>

        {/* Quick Member Chips */}
        <div className="mt-3 flex flex-wrap gap-2">
          {filteredMembers.map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => void loadQuickProfile(member.id)}
              className={`min-h-[40px] rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                selectedProfile?.id === member.id
                  ? 'border-crimson bg-crimson text-chalk'
                  : lightMode
                    ? 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-crimson'
                    : 'border-steel bg-obsidian text-silver hover:border-crimson'
              }`}
            >
              {member.fullName} • {member.phone}
            </button>
          ))}
        </div>
      </div>

      {/* 65% Live Entry Stream | 35% Quick-Profile Drawer */}
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Left 65% (8 cols) */}
        <section className={`rounded-2xl border p-5 lg:col-span-8 ${cardSurface}`}>
          <div className="mb-4 flex items-center justify-between border-b border-current/10 pb-3">
            <div>
              <h2 className="font-display text-2xl font-bold uppercase">
                Live Turnstile Entry Stream
              </h2>
              <p className={`text-xs ${lightMode ? 'text-zinc-500' : 'text-chrome'}`}>
                Denied scans pin to the top with pulsing alert border & chime. Click any card to inspect.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-500">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              Socket.IO Live
            </span>
          </div>

          {orderedLogs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-400/40 p-8 text-center text-sm text-zinc-500">
              No gate taps logged yet for this branch. Trigger a scan in <strong>/simulator</strong>{' '}
              or click a member chip above.
            </div>
          ) : (
            <div className="space-y-3">
              {orderedLogs.map((log) => {
                const denied = isDeniedStatus(log.entryStatus);
                const override = log.entryStatus === EntryStatus.MANUAL_OVERRIDE;
                return (
                  <button
                    key={log.id}
                    type="button"
                    onClick={() => log.userId && void loadQuickProfile(log.userId)}
                    className={`flex min-h-[80px] w-full items-center justify-between gap-4 rounded-xl border-2 p-4 text-left transition-all ${
                      denied
                        ? 'animate-pulse border-[#FF2A3B] bg-[#FF2A3B]/10 shadow-lg shadow-[#FF2A3B]/15'
                        : override
                          ? 'border-l-4 border-amber-500 bg-amber-500/5'
                          : lightMode
                            ? 'border-zinc-200 border-l-4 border-l-emerald-500 bg-zinc-50/70 hover:bg-zinc-100'
                            : 'border-steel border-l-4 border-l-emerald-500 bg-obsidian/80 hover:bg-obsidian'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3.5">
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-display text-lg font-extrabold ${
                          denied
                            ? 'bg-[#FF2A3B] text-white'
                            : override
                              ? 'bg-amber-500 text-zinc-950'
                              : 'bg-emerald-500/20 text-emerald-500'
                        }`}
                      >
                        {denied ? (
                          <Lock className="h-6 w-6" />
                        ) : override ? (
                          <ShieldAlert className="h-6 w-6" />
                        ) : (
                          <CheckCircle2 className="h-6 w-6" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-display text-xl font-bold uppercase">
                            {log.memberName ?? 'Unknown Member'}
                          </span>
                          <EntryStatusBadge status={log.entryStatus} />
                        </div>
                        <p className={`mt-0.5 truncate text-xs ${lightMode ? 'text-zinc-600' : 'text-chrome'}`}>
                          {log.reason || log.overrideReason || log.planName || 'Turnstile verification'}
                          {log.dueAmountBdt && log.dueAmountBdt > 0
                            ? ` • Balance Due: ${formatBdt(log.dueAmountBdt)}`
                            : ''}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="font-mono text-xs font-semibold">
                        {new Date(log.scannedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </p>
                      <p className={`text-[11px] ${lightMode ? 'text-zinc-500' : 'text-chrome'}`}>
                        Inspect →
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Right 35% (4 cols) — Quick-Profile Drawer */}
        <aside className={`rounded-2xl border p-5 lg:col-span-4 ${cardSurface}`}>
          <h2 className="font-display border-b border-current/10 pb-3 text-2xl font-bold uppercase">
            Quick-Profile Drawer
          </h2>

          {profileLoading ? (
            <div className="mt-4 space-y-3">
              <SkeletonBlock lightMode={lightMode} className="h-24" />
              <SkeletonBlock lightMode={lightMode} className="h-32" />
              <SkeletonBlock lightMode={lightMode} className="h-12" />
            </div>
          ) : !selectedProfile ? (
            <div className="mt-6 rounded-xl border border-dashed border-zinc-400/40 p-6 text-center text-sm text-zinc-500">
              Select a member from the Live Entry Stream or Quick-Search bar to view profile, dues,
              and gate controls.
            </div>
          ) : (
            <div className="mt-4 space-y-5">
              {/* Identity Header */}
              <div className="flex items-center gap-3.5">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-oxblood font-display text-2xl font-extrabold text-chalk">
                  {selectedProfile.fullName
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate font-display text-2xl font-bold uppercase">
                    {selectedProfile.fullName}
                  </h3>
                  <p className={`text-xs ${lightMode ? 'text-zinc-500' : 'text-chrome'}`}>
                    {selectedProfile.phone} • {selectedProfile.status}
                  </p>
                  {selectedProfile.activeCardUid ? (
                    <p className="mt-0.5 font-mono text-[11px] text-amber-500">
                      RFID: {selectedProfile.activeCardUid}
                    </p>
                  ) : null}
                </div>
              </div>

              {/* Subscription & Balance Box */}
              <div
                className={`rounded-xl border p-4 ${
                  lightMode ? 'border-zinc-200 bg-zinc-50' : 'border-steel bg-obsidian/70'
                }`}
              >
                {selectedProfile.subscription ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase">
                        {selectedProfile.subscription.planName}
                      </span>
                      <PaymentStatusBadge status={selectedProfile.subscription.paymentStatus} />
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className={`text-xs ${lightMode ? 'text-zinc-500' : 'text-chrome'}`}>
                        Balance Due
                      </span>
                      <span
                        className={`font-display text-2xl font-extrabold ${
                          selectedProfile.subscription.dueAmountBdt > 0
                            ? 'text-[#FF2A3B]'
                            : 'text-emerald-500'
                        }`}
                      >
                        {formatBdt(selectedProfile.subscription.dueAmountBdt)}
                      </span>
                    </div>
                    <p className={`text-xs ${lightMode ? 'text-zinc-500' : 'text-chrome'}`}>
                      Expires:{' '}
                      {new Date(selectedProfile.subscription.endDate).toLocaleDateString()} •
                      Credits: {selectedProfile.subscription.remainingCredits}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs font-medium text-amber-500">
                    No active subscription. Use Collect Payment to assign a plan.
                  </p>
                )}
              </div>

              {/* 3 High-Clarity Reception CTAs */}
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => {
                    if (
                      selectedProfile.subscription &&
                      selectedProfile.subscription.dueAmountBdt > 0
                    ) {
                      setSettleAmount(String(selectedProfile.subscription.dueAmountBdt));
                      setCollectOpen(true);
                    } else {
                      setCheckoutPlanModalOpen(true);
                    }
                  }}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-emerald-500"
                >
                  <Banknote className="h-5 w-5" />
                  {selectedProfile.subscription && selectedProfile.subscription.dueAmountBdt > 0
                    ? `Collect Payment (${formatBdt(selectedProfile.subscription.dueAmountBdt)})`
                    : 'Collect Payment / New Plan'}
                </button>

                <button
                  type="button"
                  onClick={() => setOverrideOpen(true)}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border-2 border-amber-500 bg-amber-500/10 px-4 text-sm font-bold uppercase tracking-wider text-amber-500 transition-colors hover:bg-amber-500/20"
                >
                  <ShieldAlert className="h-5 w-5" />
                  Manual Override
                </button>

                <button
                  type="button"
                  onClick={() => setReplaceOpen(true)}
                  className={`flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold uppercase tracking-wider transition-colors ${
                    lightMode
                      ? 'border-zinc-300 bg-zinc-100 text-zinc-800 hover:bg-zinc-200'
                      : 'border-steel bg-obsidian text-silver hover:text-chalk'
                  }`}
                >
                  <CreditCard className="h-5 w-5" />
                  Replace Card ({BUSINESS_RULES.CARD_REPLACEMENT_FEE_BDT} BDT)
                </button>
              </div>

              {/* Recent 5 Check-ins */}
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-chrome">
                  Recent 5 Check-Ins
                </p>
                {selectedProfile.recentAttendance.length === 0 ? (
                  <p className="text-xs text-zinc-500">No recent attendance logs.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedProfile.recentAttendance.slice(0, 5).map((att) => (
                      <div
                        key={att.id}
                        className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${
                          lightMode
                            ? 'border-zinc-200 bg-zinc-50'
                            : 'border-steel bg-obsidian/60'
                        }`}
                      >
                        <EntryStatusBadge status={att.entryStatus} />
                        <span className="font-mono text-[11px] text-chrome">
                          {new Date(att.scannedAt).toLocaleDateString()}{' '}
                          {new Date(att.scannedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Collect Payment / Settle Due Modal */}
      <Modal
        open={collectOpen}
        onClose={() => setCollectOpen(false)}
        title="Collect Overdue Balance"
        subtitle={selectedProfile ? `Member: ${selectedProfile.fullName}` : undefined}
        lightMode={lightMode}
      >
        <form onSubmit={handleSettleDue} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase text-chrome">
              Settlement Amount (BDT)
            </span>
            <input
              type="number"
              required
              min={1}
              value={settleAmount}
              onChange={(e) => setSettleAmount(e.target.value)}
              className={`min-h-[48px] w-full rounded-xl border px-3.5 text-base font-bold outline-none focus:border-crimson ${
                lightMode ? 'border-zinc-300 bg-white' : 'border-steel bg-obsidian text-chalk'
              }`}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase text-chrome">
              Payment Channel
            </span>
            <select
              value={settleMethod}
              onChange={(e) => setSettleMethod(e.target.value as SettleDueDto['paymentMethod'])}
              className={`min-h-[48px] w-full rounded-xl border px-3.5 text-sm outline-none focus:border-crimson ${
                lightMode ? 'border-zinc-300 bg-white' : 'border-steel bg-obsidian text-chalk'
              }`}
            >
              <option value={PaymentMethod.CASH}>Cash (Reception Drawer)</option>
              <option value={PaymentMethod.POS_TERMINAL}>Card POS Terminal</option>
              <option value={PaymentMethod.MOCK_BKASH}>bKash</option>
              <option value={PaymentMethod.MOCK_NAGAD}>Nagad</option>
              <option value={PaymentMethod.MOCK_CARD}>Online Card</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold uppercase tracking-wider text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            <UserCheck className="h-5 w-5" />
            {submitting ? 'Recording...' : 'Confirm Due Settlement'}
          </button>
        </form>
      </Modal>

      {/* Manual Override Modal */}
      <Modal
        open={overrideOpen}
        onClose={() => setOverrideOpen(false)}
        title="Manual Gate Override"
        subtitle="Immutable AuditLog entry • Capped at 2 overrides/member/month"
        lightMode={lightMode}
      >
        <form onSubmit={handleManualOverride} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <span className="mb-1 block text-xs font-bold uppercase text-chrome">
                Branch (Auto-Filled)
              </span>
              <input
                type="text"
                readOnly
                value={activeBranch ? `${activeBranch.code} • ${activeBranch.name}` : ''}
                className={`min-h-[44px] w-full rounded-xl border px-3 text-xs font-semibold opacity-80 ${
                  lightMode ? 'border-zinc-200 bg-zinc-100' : 'border-steel bg-obsidian text-silver'
                }`}
              />
            </div>
            <div>
              <span className="mb-1 block text-xs font-bold uppercase text-chrome">
                Timestamp (Auto-Filled)
              </span>
              <input
                type="text"
                readOnly
                value={new Date().toLocaleString()}
                className={`min-h-[44px] w-full rounded-xl border px-3 text-xs font-semibold opacity-80 ${
                  lightMode ? 'border-zinc-200 bg-zinc-100' : 'border-steel bg-obsidian text-silver'
                }`}
              />
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase text-chrome">
              Mandatory Reason *
            </span>
            <select
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value as ManualOverrideDto['reason'])}
              className={`min-h-[48px] w-full rounded-xl border px-3.5 text-sm outline-none focus:border-crimson ${
                lightMode ? 'border-zinc-300 bg-white' : 'border-steel bg-obsidian text-chalk'
              }`}
            >
              <option value="Promised to pay tomorrow">Promised to pay tomorrow</option>
              <option value="Card reader glitch">Card reader glitch</option>
              <option value="Admin approved">Admin approved</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 flex items-center justify-between text-xs font-bold uppercase text-chrome">
              <span>Justification Note (Min 10 Chars) *</span>
              <span>{overrideNotes.trim().length} / 10+</span>
            </span>
            <textarea
              required
              minLength={BUSINESS_RULES.MIN_OVERRIDE_NOTE_LENGTH}
              rows={3}
              value={overrideNotes}
              onChange={(e) => setOverrideNotes(e.target.value)}
              placeholder="Explain why turnstile override is authorized..."
              className={`w-full rounded-xl border p-3 text-sm outline-none focus:border-crimson ${
                lightMode ? 'border-zinc-300 bg-white' : 'border-steel bg-obsidian text-chalk'
              }`}
            />
          </label>

          <button
            type="submit"
            disabled={submitting || overrideNotes.trim().length < BUSINESS_RULES.MIN_OVERRIDE_NOTE_LENGTH}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-amber-500 text-sm font-bold uppercase tracking-wider text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
          >
            <AlertTriangle className="h-5 w-5" />
            {submitting ? 'Unlocking Gate...' : 'Confirm Override & Unlock Gate'}
          </button>
        </form>
      </Modal>

      {/* Replace Card Modal */}
      <Modal
        open={replaceOpen}
        onClose={() => setReplaceOpen(false)}
        title="Replace RFID Access Card"
        subtitle={`Revokes old UID immediately & bills ${BUSINESS_RULES.CARD_REPLACEMENT_FEE_BDT} BDT`}
        lightMode={lightMode}
      >
        <form onSubmit={handleReplaceCard} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase text-chrome">
              New RFID Card UID *
            </span>
            <input
              type="text"
              required
              minLength={4}
              value={newCardUid}
              onChange={(e) => setNewCardUid(e.target.value.toUpperCase())}
              placeholder="VA-RFID-9012"
              className={`min-h-[48px] w-full rounded-xl border px-3.5 font-mono text-sm uppercase outline-none focus:border-crimson ${
                lightMode ? 'border-zinc-300 bg-white' : 'border-steel bg-obsidian text-chalk'
              }`}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase text-chrome">Reason</span>
              <select
                value={replaceReason}
                onChange={(e) => setReplaceReason(e.target.value as 'LOST' | 'DAMAGED')}
                className={`min-h-[48px] w-full rounded-xl border px-3 text-sm ${
                  lightMode ? 'border-zinc-300 bg-white' : 'border-steel bg-obsidian text-chalk'
                }`}
              >
                <option value="LOST">Lost Card</option>
                <option value="DAMAGED">Damaged Card</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase text-chrome">
                Fee Payment ({BUSINESS_RULES.CARD_REPLACEMENT_FEE_BDT} BDT)
              </span>
              <select
                value={replaceMethod}
                onChange={(e) =>
                  setReplaceMethod(e.target.value as ReplaceCardDto['paymentMethod'])
                }
                className={`min-h-[48px] w-full rounded-xl border px-3 text-sm ${
                  lightMode ? 'border-zinc-300 bg-white' : 'border-steel bg-obsidian text-chalk'
                }`}
              >
                <option value={PaymentMethod.CASH}>Cash</option>
                <option value={PaymentMethod.POS_TERMINAL}>Card POS</option>
                <option value={PaymentMethod.MOCK_BKASH}>bKash</option>
                <option value={PaymentMethod.MOCK_NAGAD}>Nagad</option>
              </select>
            </label>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-crimson text-sm font-bold uppercase tracking-wider text-chalk hover:bg-crimson-hover disabled:opacity-50"
          >
            <CreditCard className="h-5 w-5" />
            {submitting ? 'Replacing...' : `Issue New Card (${BUSINESS_RULES.CARD_REPLACEMENT_FEE_BDT} BDT)`}
          </button>
        </form>
      </Modal>

      {/* Quick Walk-In Onboard Modal */}
      <Modal
        open={walkInOpen}
        onClose={() => setWalkInOpen(false)}
        title="Quick Walk-In Onboard"
        subtitle={`Assigns branch ${activeBranch?.code ?? ''} and optional RFID Card UID`}
        lightMode={lightMode}
      >
        <form onSubmit={handleWalkInOnboard} className="space-y-3.5">
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase text-chrome">Full Name *</span>
            <input
              type="text"
              required
              minLength={2}
              value={walkInName}
              onChange={(e) => setWalkInName(e.target.value)}
              placeholder="Tanvir Ahmed"
              className={`min-h-[48px] w-full rounded-xl border px-3.5 text-sm ${
                lightMode ? 'border-zinc-300 bg-white' : 'border-steel bg-obsidian text-chalk'
              }`}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase text-chrome">Phone *</span>
              <input
                type="tel"
                required
                minLength={10}
                value={walkInPhone}
                onChange={(e) => setWalkInPhone(e.target.value)}
                className={`min-h-[48px] w-full rounded-xl border px-3.5 text-sm ${
                  lightMode ? 'border-zinc-300 bg-white' : 'border-steel bg-obsidian text-chalk'
                }`}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase text-chrome">Email</span>
              <input
                type="email"
                value={walkInEmail}
                onChange={(e) => setWalkInEmail(e.target.value)}
                className={`min-h-[48px] w-full rounded-xl border px-3.5 text-sm ${
                  lightMode ? 'border-zinc-300 bg-white' : 'border-steel bg-obsidian text-chalk'
                }`}
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase text-chrome">
                Emergency Contact
              </span>
              <input
                type="text"
                value={walkInEmergency}
                onChange={(e) => setWalkInEmergency(e.target.value)}
                className={`min-h-[48px] w-full rounded-xl border px-3.5 text-sm ${
                  lightMode ? 'border-zinc-300 bg-white' : 'border-steel bg-obsidian text-chalk'
                }`}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase text-chrome">
                Bind RFID UID (Optional)
              </span>
              <input
                type="text"
                value={walkInCardUid}
                onChange={(e) => setWalkInCardUid(e.target.value.toUpperCase())}
                placeholder="VA-RFID-9910"
                className={`min-h-[48px] w-full rounded-xl border px-3.5 font-mono text-sm uppercase ${
                  lightMode ? 'border-zinc-300 bg-white' : 'border-steel bg-obsidian text-chalk'
                }`}
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-crimson text-sm font-bold uppercase tracking-wider text-chalk hover:bg-crimson-hover disabled:opacity-50"
          >
            <UserPlus className="h-5 w-5" />
            {submitting ? 'Onboarding...' : 'Create Walk-In Member'}
          </button>
        </form>
      </Modal>

      {/* Mock Checkout for New Plan on Selected Profile */}
      <MockCheckoutModal
        open={checkoutPlanModalOpen}
        onClose={() => setCheckoutPlanModalOpen(false)}
        plan={plans[0] ?? null}
        targetUserId={selectedProfile?.id}
        targetUserName={selectedProfile?.fullName}
        lightMode={lightMode}
        onSuccess={() => {
          if (selectedProfile) void loadQuickProfile(selectedProfile.id);
        }}
      />

      <ToastBanner toast={toast} onDismiss={() => setToast(null)} />
    </PortalShell>
  );
}
