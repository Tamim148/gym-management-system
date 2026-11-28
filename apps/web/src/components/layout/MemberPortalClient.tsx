'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  Dumbbell,
  Flame,
  Home,
  KeyRound,
  Lock,
  LogOut,
  QrCode,
  Snowflake,
  Tag,
  User,
  Users,
  WifiOff,
} from 'lucide-react';
import {
  BookingStatus,
  SessionType,
  type AuthUserProfile,
  type BookSessionResponse,
  type FreezeSubscriptionDto,
  type MemberQuickProfile,
} from '@vintage/shared';
import { ApiError, apiDelete, apiGet, apiPost } from '@/lib/api';
import { fetchMe, formatBdt, logoutAndWipe } from '@/lib/dal';
import type {
  BranchItem,
  CampaignItem,
  MembershipPlanItem,
  SmartLockerItem,
  SubscriptionItem,
  TrainerSessionItem,
  UserSummaryItem,
} from '@/lib/types';
import { MetallicQrPassCard } from '@/components/cards/MetallicQrPassCard';
import { MockCheckoutModal } from '@/components/billing/MockCheckoutModal';
import { BrandCrest } from '@/components/ui/BrandCrest';
import { Modal } from '@/components/ui/Modal';
import { SkeletonBlock } from '@/components/ui/Skeleton';
import { PaymentStatusBadge } from '@/components/ui/StatusBadge';
import { ToastBanner, type ToastState } from '@/components/ui/ToastBanner';

export type MemberTab = 'home' | 'schedule' | 'pass' | 'workouts' | 'profile';

interface MemberPortalClientProps {
  initialTab?: MemberTab;
}

const TAB_ROUTES: Record<MemberTab, string> = {
  home: '/member',
  schedule: '/member/schedule',
  pass: '/member/pass',
  workouts: '/member/workouts',
  profile: '/member/profile',
};

export function MemberPortalClient({ initialTab = 'home' }: MemberPortalClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<MemberTab>(initialTab);
  const [user, setUser] = useState<AuthUserProfile | null>(null);
  const [quickProfile, setQuickProfile] = useState<MemberQuickProfile | null>(null);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [plans, setPlans] = useState<MembershipPlanItem[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [sessions, setSessions] = useState<TrainerSessionItem[]>([]);
  const [lockers, setLockers] = useState<SmartLockerItem[]>([]);
  const [familyAccounts, setFamilyAccounts] = useState<UserSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [browserOffline, setBrowserOffline] = useState(false);

  // Filters & Modals
  const [scheduleFilter, setScheduleFilter] = useState<'ALL' | 'PT' | 'GROUP' | 'OFF_PEAK'>('ALL');
  const [planPickerOpen, setPlanPickerOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<MembershipPlanItem | null>(null);
  const [freezeOpen, setFreezeOpen] = useState(false);
  const [freezeDays, setFreezeDays] = useState('7');
  const [freezeReason, setFreezeReason] = useState('Travel / Personal Break');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const switchTab = (tab: MemberTab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', TAB_ROUTES[tab]);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setBrowserOffline(!navigator.onLine);
    const goOff = () => setBrowserOffline(true);
    const goOn = () => setBrowserOffline(false);
    window.addEventListener('offline', goOff);
    window.addEventListener('online', goOn);
    return () => {
      window.removeEventListener('offline', goOff);
      window.removeEventListener('online', goOn);
    };
  }, []);

  const loadMemberData = useCallback(async (me: AuthUserProfile, branchId?: string) => {
    try {
      const [
        branchRes,
        subRes,
        planRes,
        campRes,
        profileRes,
        userListRes,
      ] = await Promise.all([
        apiGet<BranchItem[]>('/api/branches'),
        apiGet<SubscriptionItem[]>('/api/billing/subscriptions'),
        apiGet<MembershipPlanItem[]>('/api/billing/plans'),
        apiGet<CampaignItem[]>('/api/billing/campaigns'),
        apiGet<MemberQuickProfile>(`/api/users/${me.id}/quick-profile`).catch(() => null),
        apiGet<UserSummaryItem[]>('/api/users').catch(() => []),
      ]);

      setBranches(branchRes);
      const targetBranch = branchId || me.homeBranchId || branchRes[0]?.id || '';
      setSelectedBranchId(targetBranch);
      setSubscriptions(subRes);
      setPlans(planRes);
      setCheckoutPlan((prev) => prev ?? planRes[0] ?? null);
      setCampaigns(campRes.filter((c) => c.isActive));
      setQuickProfile(profileRes);
      setFamilyAccounts(userListRes.filter((u) => u.primaryPayerId === me.id));

      if (targetBranch) {
        const [sessionRes, lockerRes] = await Promise.all([
          apiGet<TrainerSessionItem[]>(
            `/api/scheduling/sessions?branchId=${encodeURIComponent(targetBranch)}`,
          ).catch(() => []),
          apiGet<SmartLockerItem[]>(
            `/api/facility/lockers?branchId=${encodeURIComponent(targetBranch)}`,
          ).catch(() => []),
        ]);
        setSessions(sessionRes);
        setLockers(lockerRes);
      }
    } catch {
      // Offline fallback preserves cached QR pass
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const me = await fetchMe();
      if (!me) {
        router.replace('/login');
        return;
      }
      setUser(me);
      await loadMemberData(me);
      setLoading(false);
    })();
  }, [router, loadMemberData]);

  const handleBranchChange = async (newBranchId: string) => {
    setSelectedBranchId(newBranchId);
    if (!user) return;
    const [sessionRes, lockerRes] = await Promise.all([
      apiGet<TrainerSessionItem[]>(
        `/api/scheduling/sessions?branchId=${encodeURIComponent(newBranchId)}`,
      ).catch(() => []),
      apiGet<SmartLockerItem[]>(
        `/api/facility/lockers?branchId=${encodeURIComponent(newBranchId)}`,
      ).catch(() => []),
    ]);
    setSessions(sessionRes);
    setLockers(lockerRes);
  };

  const activeBranch = useMemo(
    () => branches.find((b) => b.id === selectedBranchId) ?? branches[0] ?? null,
    [branches, selectedBranchId],
  );

  const currentSubscription = subscriptions[0] ?? null;

  const daysRemaining = useMemo(() => {
    const endIso = currentSubscription?.endDate ?? quickProfile?.subscription?.endDate;
    if (!endIso) return null;
    const diff = Math.ceil((new Date(endIso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return diff;
  }, [currentSubscription, quickProfile]);

  const crowdStats = useMemo(() => {
    if (!activeBranch || activeBranch.maxOccupancy === 0) {
      return { pct: 0, label: 'Quiet' };
    }
    const pct = Math.min(
      100,
      Math.round((activeBranch.currentOccupancy / activeBranch.maxOccupancy) * 100),
    );
    const label = pct >= 75 ? 'Peak' : pct >= 40 ? 'Moderate' : 'Quiet';
    return { pct, label };
  }, [activeBranch]);

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (s.isCancelled) return false;
      if (scheduleFilter === 'PT') return s.type === SessionType.PERSONAL_TRAINING;
      if (scheduleFilter === 'GROUP') return s.type === SessionType.GROUP_CLASS;
      if (scheduleFilter === 'OFF_PEAK') return s.isOffPeakDeal;
      return true;
    });
  }, [sessions, scheduleFilter]);

  const nextBookedSession = useMemo(
    () =>
      sessions.find(
        (s) =>
          !s.isCancelled &&
          (s.myBookingStatus === BookingStatus.CONFIRMED ||
            s.myBookingStatus === BookingStatus.WAITLISTED),
      ) ?? null,
    [sessions],
  );

  const myClaimedLocker = useMemo(
    () => lockers.find((l) => l.assignedUserId === user?.id) ?? null,
    [lockers, user?.id],
  );

  const handleBookSession = async (sessionId: string) => {
    setSubmitting(true);
    try {
      const res = await apiPost<BookSessionResponse>(
        `/api/scheduling/sessions/${sessionId}/book`,
        {},
      );
      setToast({
        type: 'success',
        message:
          res.status === 'CONFIRMED'
            ? 'Slot confirmed! Reminder scheduled.'
            : `Class full — Added to Waitlist #${res.waitlistOrder ?? 1}.`,
      });
      if (user) await loadMemberData(user, selectedBranchId);
    } catch (err) {
      setToast({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Unable to book session.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    setSubmitting(true);
    try {
      await apiDelete(`/api/scheduling/bookings/${bookingId}`);
      setToast({
        type: 'info',
        message: 'Booking cancelled & waitlist auto-promotion triggered.',
      });
      if (user) await loadMemberData(user, selectedBranchId);
    } catch (err) {
      setToast({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Unable to cancel booking.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLockerTap = async (lockerId: string) => {
    if (!user) return;
    try {
      await apiPost(`/api/facility/lockers/${lockerId}/tap`, { userId: user.id });
      setToast({ type: 'success', message: 'Smart Locker relay toggled!' });
      await loadMemberData(user, selectedBranchId);
    } catch (err) {
      setToast({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Locker action failed.',
      });
    }
  };

  const handleFreezePlan = async (e: FormEvent) => {
    e.preventDefault();
    const subId = currentSubscription?.id ?? quickProfile?.subscription?.id;
    if (!subId) return;
    setSubmitting(true);
    try {
      const payload: FreezeSubscriptionDto = {
        days: Number(freezeDays),
        reason: freezeReason.trim() || undefined,
      };
      await apiPost(`/api/billing/subscriptions/${subId}/freeze`, payload);
      setToast({
        type: 'success',
        message: `Membership frozen for ${payload.days} days.`,
      });
      setFreezeOpen(false);
      if (user) await loadMemberData(user, selectedBranchId);
    } catch (err) {
      setToast({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Freeze request rejected.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logoutAndWipe();
    router.push('/login');
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-obsidian p-4">
        <div className="mx-auto max-w-md space-y-4">
          <SkeletonBlock className="h-20" />
          <SkeletonBlock className="h-36" />
          <SkeletonBlock className="h-44" />
        </div>
      </div>
    );
  }

  const topCampaign = campaigns[0] ?? null;

  return (
    <div className="min-h-screen bg-obsidian pb-28 text-chalk">
      {/* Offline Banner */}
      {browserOffline || branches.some((b) => !b.edgeNodeOnline) ? (
        <div className="flex items-center justify-center gap-2 bg-amber-500 px-3 py-2 text-xs font-bold uppercase text-zinc-950">
          <WifiOff className="h-4 w-4" strokeWidth={1.75} />
          Offline Mode — Local Queue Active (QR Pass Cached)
        </div>
      ) : null}

      {/* Top Mobile PWA Header */}
      <header className="sticky top-0 z-20 border-b border-steel bg-obsidian px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandCrest size={38} />
            <div>
              <p className="font-display text-lg font-extrabold uppercase leading-none text-chalk">
                Vintage Aesthetics
              </p>
              <p className="text-[11px] text-chrome">{user.fullName}</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            {daysRemaining !== null && daysRemaining > 0 ? (
              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-400 tabular-nums">
                {daysRemaining} Days Left
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setCheckoutOpen(true)}
                className="min-h-[38px] rounded-full bg-crimson px-3.5 text-xs font-bold uppercase text-chalk hover:bg-crimson-hover"
              >
                Renew Now
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="mx-auto max-w-2xl space-y-5 px-4 pt-5">
        {/* Gold's Gym Style Branch Switcher */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-steel bg-iron px-3.5 py-2.5">
          <span className="text-xs font-bold text-chrome">Active Club</span>
          <select
            value={selectedBranchId}
            onChange={(e) => void handleBranchChange(e.target.value)}
            aria-label="Select branch"
            className="min-h-[42px] flex-1 rounded-lg border border-steel bg-obsidian px-3 text-xs font-bold text-chalk outline-none focus:border-crimson"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} · {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* TAB 1: PLANET FITNESS STYLE HOME */}
        {activeTab === 'home' ? (
          <div className="space-y-4">
            {/* Real-Time Crowd Meter + 1-Tap QR Pass Action */}
            <section className="overflow-hidden rounded-2xl border border-steel bg-iron">
              <div className="va-led-rule w-full" />
              <div className="relative h-32 w-full overflow-hidden border-b border-steel">
                <Image
                  src="/images/strength-station.jpg"
                  alt="Strength zone at Vintage Aesthetics Gym"
                  fill
                  className="object-cover object-center"
                />
                <div className="absolute inset-0 bg-linear-to-t from-[#141418] via-[#141418]/70 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 px-5 pb-3">
                  <div>
                    <p className="text-[11px] font-semibold text-silver">
                      Live Floor Crowd Meter
                    </p>
                    <p className="font-display text-2xl font-extrabold uppercase text-chalk">
                      {activeBranch?.name ?? 'Dhaka Branch'}
                    </p>
                  </div>
                  <span className="rounded-full border border-emerald-500/40 bg-obsidian/90 px-2.5 py-1 text-xs font-bold text-emerald-400 tabular-nums">
                    {crowdStats.label} · {crowdStats.pct}%
                  </span>
                </div>
              </div>

              <div className="space-y-4 p-5">
                <div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-obsidian">
                    <div
                      className="h-full rounded-full bg-linear-to-r from-emerald-500 via-amber-500 to-crimson transition-all"
                      style={{ width: `${crowdStats.pct}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-chrome tabular-nums">
                    {activeBranch?.currentOccupancy ?? 0} of {activeBranch?.maxOccupancy ?? 80} members inside right now
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => switchTab('pass')}
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-crimson text-xs font-bold uppercase tracking-wider text-chalk transition-colors hover:bg-crimson-hover"
                >
                  <QrCode className="h-4 w-4" strokeWidth={1.75} />
                  Open 1-Tap Gate QR Pass
                </button>
              </div>
            </section>

            {/* Festival Offer Banner */}
            {topCampaign ? (
              <section className="overflow-hidden rounded-2xl border border-oxblood bg-iron">
                <div className="va-led-rule w-full" />
                <div className="flex items-start justify-between gap-3 p-5">
                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-crimson/50 bg-oxblood/40 px-2.5 py-0.5 text-[11px] font-bold text-chalk">
                      <Tag className="h-3 w-3 text-crimson" strokeWidth={1.75} />
                      Festival Offer
                    </span>
                    <h2 className="font-display mt-2 text-2xl font-extrabold uppercase text-chalk">
                      {topCampaign.name}
                    </h2>
                    <p className="mt-1 text-xs text-silver">
                      Apply code <strong className="font-mono text-amber-400">{topCampaign.promoCode}</strong> at checkout.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCheckoutOpen(true)}
                    className="min-h-11 shrink-0 rounded-xl bg-crimson px-4 text-xs font-bold uppercase text-chalk hover:bg-crimson-hover"
                  >
                    Claim
                  </button>
                </div>
              </section>
            ) : null}

            {/* My Journey Streak + Next Booked Session */}
            <div className="grid gap-4 sm:grid-cols-2">
              <section className="va-card rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-chrome">
                    My Journey Streak
                  </p>
                  <Award className="h-5 w-5 text-silver" strokeWidth={1.75} />
                </div>
                <div className="mt-2 flex items-baseline gap-2 tabular-nums">
                  <span className="font-display text-4xl font-extrabold text-chalk">
                    {user.loyaltyPoints}
                  </span>
                  <span className="text-xs font-bold text-chrome">Iron Points</span>
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-amber-400 tabular-nums">
                  <Flame className="h-4 w-4" strokeWidth={1.75} />
                  Health Consistency: {Math.round(user.healthScore)}%
                </p>
              </section>

              <section className="va-card rounded-2xl p-4">
                <p className="text-xs font-bold text-chrome">
                  Next Booked Session
                </p>
                {nextBookedSession ? (
                  <div className="mt-2 space-y-1">
                    <p className="font-display text-xl font-bold uppercase text-chalk">
                      {nextBookedSession.title}
                    </p>
                    <p className="text-xs text-silver">
                      {nextBookedSession.trainerName} ·{' '}
                      {new Date(nextBookedSession.startTime).toLocaleString()}
                    </p>
                    <span className="mt-1 inline-block rounded bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-400">
                      {nextBookedSession.myBookingStatus}
                    </span>
                  </div>
                ) : (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-chrome">No upcoming classes booked.</p>
                    <button
                      type="button"
                      onClick={() => switchTab('schedule')}
                      className="min-h-[42px] rounded-xl border border-crimson bg-crimson/15 px-3 text-xs font-bold uppercase text-chalk hover:bg-crimson"
                    >
                      Browse Classes
                    </button>
                  </div>
                )}
              </section>
            </div>
          </div>
        ) : null}

        {/* TAB 2: SCHEDULE & BOOKING */}
        {activeTab === 'schedule' ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: 'ALL', label: 'All Sessions' },
                  { id: 'PT', label: '1-on-1 PT' },
                  { id: 'GROUP', label: 'Group Class' },
                  { id: 'OFF_PEAK', label: 'Off-Peak Deals' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setScheduleFilter(f.id)}
                  className={`min-h-[42px] rounded-xl border px-3.5 text-xs font-bold uppercase ${
                    scheduleFilter === f.id
                      ? 'border-crimson bg-crimson text-chalk'
                      : 'border-steel bg-iron text-chrome hover:text-chalk'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {filteredSessions.length === 0 ? (
              <div className="va-card rounded-2xl p-6 text-center text-sm text-chrome">
                No sessions match this filter at {activeBranch?.name}.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSessions.map((session) => {
                  const isFull = session.confirmedCount >= session.maxCapacity;
                  const alreadyBooked = Boolean(session.myBookingId);
                  return (
                    <div key={session.id} className="va-card rounded-2xl p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded bg-oxblood px-2 py-0.5 text-[10px] font-bold uppercase text-chalk">
                              {session.type.replace('_', ' ')}
                            </span>
                            {session.isOffPeakDeal ? (
                              <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-400">
                                Off-Peak Deal · {session.offPeakPriceBdt ? formatBdt(session.offPeakPriceBdt) : '25% Off'}
                              </span>
                            ) : null}
                          </div>
                          <h3 className="font-display mt-2 text-2xl font-bold uppercase text-chalk">
                            {session.title}
                          </h3>
                          <p className="text-xs text-chrome">
                            {session.trainerName} · {session.zoneName ?? 'Main Floor'}
                          </p>
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-silver">
                            <Clock className="h-3.5 w-3.5 text-crimson" strokeWidth={1.75} />
                            {new Date(session.startTime).toLocaleString()}
                          </p>
                        </div>

                        <div className="text-right tabular-nums">
                          <p className="font-display text-xl font-extrabold">
                            {session.confirmedCount}/{session.maxCapacity}
                          </p>
                          <p className="text-[11px] text-chrome">
                            {session.waitlistCount > 0 ? `${session.waitlistCount} waitlisted` : 'Spots'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4">
                        {alreadyBooked && session.myBookingId ? (
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => void handleCancelBooking(session.myBookingId!)}
                            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#FF2A3B]/60 bg-[#FF2A3B]/10 text-xs font-bold uppercase text-[#FF2A3B] hover:bg-[#FF2A3B]/20"
                          >
                            Cancel {session.myBookingStatus} Booking
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => void handleBookSession(session.id)}
                            className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors ${
                              isFull
                                ? 'border border-amber-500 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                                : 'bg-crimson text-chalk hover:bg-crimson-hover'
                            }`}
                          >
                            {isFull ? 'Join Automated Waitlist' : 'Book Slot'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

        {/* TAB 3: METALLIC QR PASS + SMART LOCKERS */}
        {activeTab === 'pass' ? (
          <div className="space-y-5">
            <MetallicQrPassCard
              userId={user.id}
              memberName={user.fullName}
              branchName={activeBranch?.name ?? user.branchName}
              planName={
                currentSubscription?.planName ??
                quickProfile?.subscription?.planName ??
                'Vintage Member'
              }
            />

            <section className="va-card rounded-2xl p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-crimson" strokeWidth={1.75} />
                  <h2 className="font-display text-xl font-bold uppercase">Smart Locker Status</h2>
                </div>
                {myClaimedLocker ? (
                  <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-400">
                    Claimed: {myClaimedLocker.lockerNumber}
                  </span>
                ) : (
                  <span className="text-xs text-chrome">Tap free locker to claim</span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {lockers.map((locker) => {
                  const mine = locker.assignedUserId === user.id;
                  const taken = Boolean(locker.assignedUserId) && !mine;
                  return (
                    <button
                      key={locker.id}
                      type="button"
                      disabled={taken}
                      onClick={() => void handleLockerTap(locker.id)}
                      className={`flex min-h-[56px] flex-col items-center justify-center rounded-xl border p-2 text-xs font-bold transition-colors ${
                        mine
                          ? 'border-crimson bg-oxblood/50 text-chalk'
                          : taken
                            ? 'border-steel bg-obsidian text-zinc-600 opacity-60'
                            : 'border-steel bg-obsidian text-silver hover:border-crimson'
                      }`}
                    >
                      <span>{locker.lockerNumber}</span>
                      <span className="text-[10px] uppercase">
                        {mine ? 'Release' : taken ? 'In Use' : 'Free'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        ) : null}

        {/* TAB 4: WORKOUTS */}
        {activeTab === 'workouts' ? (
          <div className="space-y-4">
            <section className="va-card rounded-2xl p-5">
              <h2 className="font-display text-2xl font-bold uppercase">
                Workout &amp; Attendance Log
              </h2>
              <p className="mt-1 text-xs text-chrome">
                Recent verified gym check-ins and iron consistency streaks.
              </p>

              <div className="mt-4 space-y-2.5">
                {(quickProfile?.recentAttendance ?? []).length === 0 ? (
                  <p className="text-xs text-chrome">
                    No check-ins recorded yet. Scan your QR Pass at the gate or /simulator.
                  </p>
                ) : (
                  quickProfile!.recentAttendance.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center justify-between rounded-xl border border-steel bg-obsidian px-4 py-3 text-xs"
                    >
                      <span className="flex items-center gap-2 font-bold">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" strokeWidth={1.75} />
                        {att.entryStatus}
                      </span>
                      <span className="font-mono text-chrome tabular-nums">
                        {new Date(att.scannedAt).toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        ) : null}

        {/* TAB 5: PROFILE, FAMILY, FREEZE & RENEW */}
        {activeTab === 'profile' ? (
          <div className="space-y-4">
            <section className="va-card space-y-4 rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-2xl font-bold uppercase">{user.fullName}</h2>
                  <p className="text-xs text-chrome">
                    {user.email ?? user.phone} · {user.status}
                  </p>
                </div>
                {currentSubscription ? (
                  <PaymentStatusBadge status={currentSubscription.paymentStatus} />
                ) : null}
              </div>

              {(currentSubscription || quickProfile?.subscription) ? (
                <div className="rounded-xl border border-steel bg-obsidian p-4 text-xs">
                  <p className="font-bold uppercase text-chalk">
                    {currentSubscription?.planName ??
                      currentSubscription?.plan?.name ??
                      quickProfile?.subscription?.planName}
                  </p>
                  <p className="mt-1 text-chrome">
                    Valid Until:{' '}
                    {new Date(
                      currentSubscription?.endDate ?? quickProfile!.subscription!.endDate,
                    ).toLocaleDateString()}
                  </p>
                  {(currentSubscription?.dueAmountBdt ?? quickProfile?.subscription?.dueAmountBdt ?? 0) >
                  0 ? (
                    <p className="mt-1 font-bold text-[#FF2A3B] tabular-nums">
                      Due Balance:{' '}
                      {formatBdt(
                        currentSubscription?.dueAmountBdt ??
                          quickProfile!.subscription!.dueAmountBdt,
                      )}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="grid gap-2.5 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setPlanPickerOpen(true)}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-crimson text-xs font-bold uppercase tracking-wider text-chalk hover:bg-crimson-hover"
                >
                  Renew / Upgrade Plan
                </button>
                <button
                  type="button"
                  disabled={!currentSubscription && !quickProfile?.subscription}
                  onClick={() => setFreezeOpen(true)}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-silver/40 bg-obsidian text-xs font-bold uppercase tracking-wider text-silver hover:border-crimson hover:text-chalk disabled:opacity-50"
                >
                  <Snowflake className="h-4 w-4" strokeWidth={1.75} />
                  Freeze Plan
                </button>
              </div>
            </section>

            {/* Family Sub-Accounts */}
            <section className="va-card rounded-2xl p-5">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-crimson" strokeWidth={1.75} />
                <h3 className="font-display text-xl font-bold uppercase">
                  Family Sub-Accounts (15% Off)
                </h3>
              </div>
              {familyAccounts.length === 0 ? (
                <p className="mt-2 text-xs text-chrome">
                  No linked dependents on this account.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {familyAccounts.map((dep) => (
                    <div
                      key={dep.id}
                      className="flex items-center justify-between rounded-xl border border-steel bg-obsidian px-3.5 py-2.5 text-xs"
                    >
                      <span className="font-bold text-chalk">{dep.fullName}</span>
                      <span className="text-chrome">{dep.phone}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <button
              type="button"
              onClick={() => void handleLogout()}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-steel bg-iron text-xs font-bold uppercase tracking-wider text-silver hover:border-crimson hover:text-chalk"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.75} />
              Sign Out &amp; Wipe Offline Pass
            </button>
          </div>
        ) : null}
      </main>

      {/* 5-Tab Mobile Bottom Navigation */}
      <nav
        aria-label="Member Mobile Navigation"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-steel bg-iron px-2 pb-safe"
      >
        <div className="mx-auto grid max-w-2xl grid-cols-5 items-center gap-1 py-1.5">
          {(
            [
              { id: 'home', label: 'Home', icon: Home },
              { id: 'schedule', label: 'Schedule', icon: Calendar },
              { id: 'pass', label: 'QR Pass', icon: QrCode, elevated: true },
              { id: 'workouts', label: 'Workouts', icon: Dumbbell },
              { id: 'profile', label: 'Profile', icon: User },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            if ('elevated' in tab && tab.elevated) {
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => switchTab(tab.id)}
                  className={`mx-auto -mt-5 flex h-14 w-14 flex-col items-center justify-center rounded-2xl border-2 shadow-xl transition-transform ${
                    active
                      ? 'scale-105 border-chalk bg-crimson text-chalk'
                      : 'border-silver/40 bg-oxblood text-chalk hover:bg-crimson'
                  }`}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                  <span className="mt-0.5 text-[9px] font-extrabold uppercase">Pass</span>
                </button>
              );
            }
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => switchTab(tab.id)}
                className={`flex min-h-12 flex-col items-center justify-center rounded-xl text-[11px] font-bold transition-colors ${
                  active ? 'text-crimson' : 'text-chrome hover:text-chalk'
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={1.75} />
                <span className="mt-0.5">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Plan Picker Modal */}
      <Modal
        open={planPickerOpen && plans.length > 0}
        onClose={() => setPlanPickerOpen(false)}
        title="Choose Plan to Renew"
        subtitle="Select a membership tier to launch Bangladesh Mock Checkout"
      >
        <div className="space-y-4">
          <div className="grid gap-2.5 sm:grid-cols-2">
            {plans.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setCheckoutPlan(p)}
                className={`min-h-[76px] rounded-xl border p-3 text-left transition-colors ${
                  checkoutPlan?.id === p.id
                    ? 'border-crimson bg-oxblood/40'
                    : 'border-steel bg-obsidian hover:border-chrome/60'
                }`}
              >
                <p className="font-display text-lg font-bold uppercase">{p.name}</p>
                <p className="text-sm font-extrabold text-crimson tabular-nums">{formatBdt(p.priceBdt)}</p>
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={!checkoutPlan}
            onClick={() => {
              setPlanPickerOpen(false);
              setCheckoutOpen(true);
            }}
            className="flex min-h-12 w-full items-center justify-center rounded-xl bg-crimson text-xs font-bold uppercase tracking-wider text-chalk hover:bg-crimson-hover disabled:opacity-50"
          >
            Continue to Mock Checkout
          </button>
        </div>
      </Modal>

      {/* Mock Checkout Modal */}
      <MockCheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        plan={checkoutPlan}
        onSuccess={() => {
          if (user) void loadMemberData(user, selectedBranchId);
        }}
      />

      {/* Freeze Plan Modal */}
      <Modal
        open={freezeOpen}
        onClose={() => setFreezeOpen(false)}
        title="Freeze Membership Plan"
        subtitle="Pause your membership for 3 to 30 days"
      >
        <form onSubmit={handleFreezePlan} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-chrome">
              Freeze Duration (3–30 Days)
            </span>
            <input
              type="number"
              min={3}
              max={30}
              required
              value={freezeDays}
              onChange={(e) => setFreezeDays(e.target.value)}
              className="min-h-12 w-full rounded-xl border border-steel bg-obsidian px-4 text-sm font-bold text-chalk"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-chrome">
              Reason (Optional)
            </span>
            <input
              type="text"
              value={freezeReason}
              onChange={(e) => setFreezeReason(e.target.value)}
              className="min-h-12 w-full rounded-xl border border-steel bg-obsidian px-4 text-sm text-chalk"
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-oxblood text-sm font-bold uppercase text-chalk transition-colors hover:bg-crimson disabled:opacity-50"
          >
            <Lock className="h-4 w-4" strokeWidth={1.75} />
            {submitting ? 'Freezing...' : 'Confirm Membership Freeze'}
          </button>
        </form>
      </Modal>

      <ToastBanner toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
