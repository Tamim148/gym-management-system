'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  DollarSign,
  Dumbbell,
  Edit3,
  List,
  LogOut,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';
import {
  BUSINESS_RULES,
  BookingStatus,
  EquipmentStatus,
  SessionType,
  UserRole,
  type AuthUserProfile,
  type CancelSessionDto,
  type CreateSessionDto,
  type UpdateSessionDto,
} from '@vintage/shared';
import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';
import { fetchMe, formatBdt, logoutAndWipe } from '@/lib/dal';
import type { BranchItem, EquipmentAssetItem, TrainerSessionItem } from '@/lib/types';
import { BrandCrest } from '@/components/ui/BrandCrest';
import { Modal } from '@/components/ui/Modal';
import { SkeletonBlock } from '@/components/ui/Skeleton';
import { ToastBanner, type ToastState } from '@/components/ui/ToastBanner';

type TrainerTab = 'schedule' | 'roster' | 'earnings';
type CalendarMode = 'DAY' | 'WEEK' | 'LIST';

function sessionTypeAccent(type: SessionType): string {
  switch (type) {
    case SessionType.PERSONAL_TRAINING:
      return 'border-l-4 border-l-crimson bg-oxblood/20';
    case SessionType.GROUP_CLASS:
      return 'border-l-4 border-l-amber-500 bg-amber-500/10';
    case SessionType.OPEN_AVAILABILITY:
    default:
      return 'border-l-4 border-l-chrome bg-iron';
  }
}

function toLocalDatetimeInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export default function TrainerPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUserProfile | null>(null);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [sessions, setSessions] = useState<TrainerSessionItem[]>([]);
  const [equipment, setEquipment] = useState<EquipmentAssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastState | null>(null);

  const [activeTab, setActiveTab] = useState<TrainerTab>('schedule');
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('LIST');
  const [selectedRosterSessionId, setSelectedRosterSessionId] = useState<string>('');

  // Create / Edit Session Modal
  const [slotModalOpen, setSlotModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<TrainerSessionItem | null>(null);
  const [slotBranchId, setSlotBranchId] = useState('');
  const [slotTitle, setSlotTitle] = useState('Strength & Hypertrophy PT');
  const [slotType, setSlotType] = useState<SessionType>(SessionType.PERSONAL_TRAINING);
  const [slotZone, setSlotZone] = useState('Studio A');
  const [slotStart, setSlotStart] = useState(() =>
    toLocalDatetimeInput(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()),
  );
  const [slotEnd, setSlotEnd] = useState(() =>
    toLocalDatetimeInput(new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString()),
  );
  const [slotCapacity, setSlotCapacity] = useState('1');

  // Booked-Slot Cancel Reason Modal
  const [cancelTarget, setCancelTarget] = useState<TrainerSessionItem | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadTrainerData = useCallback(async (me: AuthUserProfile) => {
    try {
      const [branchRes, sessionRes, equipRes] = await Promise.all([
        apiGet<BranchItem[]>('/api/branches'),
        apiGet<TrainerSessionItem[]>('/api/scheduling/sessions'),
        apiGet<EquipmentAssetItem[]>('/api/facility/equipment').catch(() => []),
      ]);
      setBranches(branchRes);
      const mine =
        me.role === UserRole.SUPER_ADMIN
          ? sessionRes
          : sessionRes.filter((s) => s.trainerId === me.id);
      setSessions(mine);
      setEquipment(equipRes);
      setSlotBranchId((prev) => prev || me.homeBranchId || branchRes[0]?.id || '');
      setSelectedRosterSessionId((prev) => prev || mine[0]?.id || '');
    } catch (err) {
      setToast({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Unable to load trainer schedule.',
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
      if (me.role !== UserRole.TRAINER && me.role !== UserRole.SUPER_ADMIN) {
        router.replace('/login');
        return;
      }
      setUser(me);
      await loadTrainerData(me);
      setLoading(false);
    })();
  }, [router, loadTrainerData]);

  const brokenEquipment = useMemo(
    () => equipment.filter((eq) => eq.status === EquipmentStatus.OUT_OF_ORDER),
    [equipment],
  );

  const visibleSessions = useMemo(() => {
    const active = sessions.filter((s) => !s.isCancelled);
    if (calendarMode === 'DAY') {
      const todayKey = new Date().toDateString();
      const todays = active.filter((s) => new Date(s.startTime).toDateString() === todayKey);
      return todays.length > 0 ? todays : active;
    }
    if (calendarMode === 'WEEK') {
      const weekAhead = Date.now() + 7 * 24 * 60 * 60 * 1000;
      return active.filter((s) => new Date(s.startTime).getTime() <= weekAhead);
    }
    return active;
  }, [sessions, calendarMode]);

  const rosterSession = useMemo(
    () => sessions.find((s) => s.id === selectedRosterSessionId) ?? sessions[0] ?? null,
    [sessions, selectedRosterSessionId],
  );

  const earningsStats = useMemo(() => {
    const active = sessions.filter((s) => !s.isCancelled);
    const completed = active.filter((s) => new Date(s.endTime).getTime() < Date.now());
    const totalAttendeeSpots = active.reduce((acc, s) => acc + s.confirmedCount, 0);
    const grossEstimatedBdt = active.reduce((acc, s) => {
      const rate =
        s.type === SessionType.PERSONAL_TRAINING
          ? 1200
          : s.isOffPeakDeal && s.offPeakPriceBdt
            ? s.offPeakPriceBdt
            : 500;
      return acc + s.confirmedCount * rate;
    }, 0);
    const commissionBdt = Math.round(
      (grossEstimatedBdt * BUSINESS_RULES.DEFAULT_TRAINER_COMMISSION_PCT) / 100,
    );
    return {
      totalSlots: active.length,
      completedCount: completed.length,
      totalAttendeeSpots,
      grossEstimatedBdt,
      commissionBdt,
    };
  }, [sessions]);

  const openCreateModal = () => {
    setEditingSession(null);
    setSlotTitle('1-on-1 Strength Coaching');
    setSlotType(SessionType.PERSONAL_TRAINING);
    setSlotZone('Free Weights Zone');
    setSlotCapacity('1');
    setSlotModalOpen(true);
  };

  const openEditModal = (session: TrainerSessionItem) => {
    setEditingSession(session);
    setSlotBranchId(session.branchId);
    setSlotTitle(session.title);
    setSlotType(session.type);
    setSlotZone(session.zoneName ?? '');
    setSlotStart(toLocalDatetimeInput(session.startTime));
    setSlotEnd(toLocalDatetimeInput(session.endTime));
    setSlotCapacity(String(session.maxCapacity));
    setSlotModalOpen(true);
  };

  const handleSaveSlot = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      const startIso = new Date(slotStart).toISOString();
      const endIso = new Date(slotEnd).toISOString();
      if (editingSession) {
        const payload: UpdateSessionDto = {
          branchId: slotBranchId,
          title: slotTitle.trim(),
          type: slotType,
          zoneName: slotZone.trim() || undefined,
          startTime: startIso,
          endTime: endIso,
          maxCapacity: Number(slotCapacity),
        };
        await apiPatch(`/api/scheduling/sessions/${editingSession.id}`, payload);
        setToast({ type: 'success', message: 'Session updated successfully.' });
      } else {
        const payload: CreateSessionDto = {
          branchId: slotBranchId,
          trainerId: user.id,
          title: slotTitle.trim(),
          type: slotType,
          zoneName: slotZone.trim() || undefined,
          startTime: startIso,
          endTime: endIso,
          maxCapacity: Number(slotCapacity),
        };
        await apiPost('/api/scheduling/sessions', payload);
        setToast({ type: 'success', message: 'New training slot published to member schedule!' });
      }
      setSlotModalOpen(false);
      await loadTrainerData(user);
    } catch (err) {
      setToast({
        type: 'error',
        message:
          err instanceof ApiError
            ? err.message
            : 'Scheduling conflict detected or invalid time window.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSlotClick = async (session: TrainerSessionItem) => {
    if (!user) return;
    if (session.confirmedCount > 0) {
      setCancelTarget(session);
      setCancelReason('');
      return;
    }

    try {
      await apiDelete(`/api/scheduling/sessions/${session.id}`);
      setToast({ type: 'info', message: 'Unbooked slot removed.' });
      await loadTrainerData(user);
    } catch (err) {
      setToast({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Unable to delete slot.',
      });
    }
  };

  const handleConfirmBookedCancel = async (e: FormEvent) => {
    e.preventDefault();
    if (!cancelTarget || !user) return;
    setSubmitting(true);
    try {
      const payload: CancelSessionDto = { reason: cancelReason.trim() };
      await apiDelete(`/api/scheduling/sessions/${cancelTarget.id}`, payload);
      setToast({
        type: 'success',
        message:
          'Booked session cancelled. Credits refunded & apology alerts dispatched to affected members.',
      });
      setCancelTarget(null);
      await loadTrainerData(user);
    } catch (err) {
      setToast({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Cancellation failed.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAttendanceToggle = async (
    bookingId: string,
    currentStatus: BookingStatus,
  ) => {
    if (!user) return;
    const nextStatus =
      currentStatus === BookingStatus.ATTENDED
        ? BookingStatus.NO_SHOW
        : BookingStatus.ATTENDED;
    try {
      await apiPatch(`/api/scheduling/bookings/${bookingId}/attendance`, {
        status: nextStatus,
      });
      setToast({ type: 'success', message: `Attendee marked ${nextStatus}.` });
      await loadTrainerData(user);
    } catch (err) {
      setToast({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Unable to update attendance.',
      });
    }
  };

  const handleLogout = async () => {
    await logoutAndWipe();
    router.push('/login');
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-obsidian p-6">
        <div className="mx-auto max-w-4xl space-y-4">
          <SkeletonBlock className="h-20" />
          <SkeletonBlock className="h-44" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-obsidian pb-24 text-chalk md:pb-12">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-steel bg-iron px-4 py-3">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-3">
            <BrandCrest size={42} alt="Vintage Aesthetics Coach Portal" />
            <div>
              <h1 className="font-display text-2xl font-extrabold uppercase leading-none">
                Trainer Portal
              </h1>
              <p className="text-xs text-chrome">{user.fullName} · {user.branchName ?? 'Coach'}</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openCreateModal}
              className="flex min-h-11 items-center gap-2 rounded-xl bg-crimson px-4 text-xs font-bold uppercase tracking-wider text-chalk hover:bg-crimson-hover"
            >
              <Plus className="h-4 w-4" strokeWidth={1.75} />
              New Slot
            </button>
            <button
              type="button"
              onClick={() => void handleLogout()}
              aria-label="Logout"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-steel bg-obsidian text-chrome hover:border-crimson hover:text-chalk"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-4 pt-5">
        {/* OUT_OF_ORDER Equipment Alert Banner */}
        {brokenEquipment.length > 0 ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-2xl border-2 border-[#FF2A3B] bg-[#FF2A3B]/15 p-4 text-sm text-chalk"
          >
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#FF2A3B]" strokeWidth={1.75} />
            <div>
              <p className="font-display text-lg font-extrabold uppercase text-[#FF2A3B]">
                Equipment Out of Order Alert
              </p>
              <p className="text-xs text-silver">
                {brokenEquipment
                  .map((eq) => `${eq.name} (${eq.zoneName})`)
                  .join(' · ')}{' '}
                — Adjust class programming accordingly.
              </p>
            </div>
          </div>
        ) : null}

        {/* Portal Tabs */}
        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-steel bg-iron p-1.5">
          {(
            [
              { id: 'schedule', label: 'Schedule CRUD', icon: Calendar },
              { id: 'roster', label: 'Live Roster', icon: ClipboardCheck },
              { id: 'earnings', label: 'Earnings (40%)', icon: DollarSign },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold uppercase tracking-wider transition-colors ${
                  active ? 'bg-crimson text-chalk' : 'text-chrome hover:text-chalk'
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} />
                <span className="truncate">{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: SCHEDULE CRUD */}
        {activeTab === 'schedule' ? (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                {(['DAY', 'WEEK', 'LIST'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setCalendarMode(mode)}
                    className={`min-h-[42px] rounded-xl border px-3.5 text-xs font-bold uppercase ${
                      calendarMode === mode
                        ? 'border-crimson bg-oxblood/50 text-chalk'
                        : 'border-steel bg-iron text-chrome'
                    }`}
                  >
                    <List className="mr-1 inline h-3.5 w-3.5" strokeWidth={1.75} />
                    {mode}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] font-bold">
                <span className="inline-flex items-center gap-1.5 rounded bg-crimson/20 px-2.5 py-1 text-crimson">
                  <Dumbbell className="h-3.5 w-3.5" strokeWidth={1.75} />
                  1-on-1 PT
                </span>
                <span className="inline-flex items-center gap-1.5 rounded bg-amber-500/20 px-2.5 py-1 text-amber-400">
                  <Users className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Group Class
                </span>
                <span className="inline-flex items-center gap-1.5 rounded bg-steel px-2.5 py-1 text-silver">
                  <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Open Slot
                </span>
              </div>
            </div>

            {visibleSessions.length === 0 ? (
              <div className="va-card rounded-2xl p-8 text-center text-sm text-chrome">
                No training sessions scheduled yet. Click <strong>New Slot</strong> to publish one.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {visibleSessions.map((session) => (
                  <div
                    key={session.id}
                    className={`va-card rounded-2xl p-4 ${sessionTypeAccent(session.type)}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[11px] font-semibold text-chrome">
                          {session.branchName} · {session.zoneName ?? 'Main Zone'}
                        </span>
                        <h3 className="font-display mt-1 text-2xl font-bold uppercase">
                          {session.title}
                        </h3>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-silver">
                          <Clock className="h-3.5 w-3.5 text-crimson" strokeWidth={1.75} />
                          {new Date(session.startTime).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right tabular-nums">
                        <p className="font-display text-2xl font-extrabold">
                          {session.confirmedCount}/{session.maxCapacity}
                        </p>
                        <p className="text-[11px] text-chrome">Booked</p>
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(session)}
                        className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-steel bg-obsidian text-xs font-bold uppercase text-silver hover:border-crimson hover:text-chalk"
                      >
                        <Edit3 className="h-3.5 w-3.5" strokeWidth={1.75} />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteSlotClick(session)}
                        className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#FF2A3B]/50 bg-[#FF2A3B]/10 text-xs font-bold uppercase text-[#FF2A3B] hover:bg-[#FF2A3B]/20"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                        {session.confirmedCount > 0 ? 'Cancel Booked' : 'Delete'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {/* TAB 2: LIVE CLASS ROSTER */}
        {activeTab === 'roster' ? (
          <section className="va-card space-y-4 rounded-2xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-2xl font-bold uppercase">
                Live Class Roster &amp; Check-In
              </h2>
              <select
                value={rosterSession?.id ?? ''}
                onChange={(e) => setSelectedRosterSessionId(e.target.value)}
                className="min-h-12 rounded-xl border border-steel bg-obsidian px-3 text-xs font-bold text-chalk"
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({s.confirmedCount}/{s.maxCapacity})
                  </option>
                ))}
              </select>
            </div>

            {rosterSession?.hasOutOfOrderEquipment ? (
              <div className="flex items-center gap-2 rounded-xl border border-[#FF2A3B] bg-[#FF2A3B]/15 p-3 text-xs font-bold text-[#FF2A3B]">
                <AlertTriangle className="h-4 w-4" strokeWidth={1.75} />
                Zone equipment reported OUT_OF_ORDER for {rosterSession.zoneName}.
              </div>
            ) : null}

            {!rosterSession || (rosterSession.attendees ?? []).length === 0 ? (
              <div className="rounded-xl border border-dashed border-steel p-6 text-center text-xs text-chrome">
                No confirmed attendees on this roster yet. Members can book from the Member PWA.
              </div>
            ) : (
              <div className="space-y-2.5">
                {rosterSession.attendees!.map((att) => {
                  const attended = att.status === BookingStatus.ATTENDED;
                  return (
                    <div
                      key={att.bookingId}
                      className="flex items-center justify-between gap-3 rounded-xl border border-steel bg-obsidian p-3.5"
                    >
                      <div>
                        <p className="font-bold text-chalk">{att.fullName}</p>
                        <p className="text-xs text-chrome">
                          {att.phone} · Status: {att.status}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleAttendanceToggle(att.bookingId, att.status)}
                        className={`flex min-h-11 items-center gap-1.5 rounded-xl px-4 text-xs font-bold uppercase ${
                          attended
                            ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                            : 'border border-steel bg-iron text-silver hover:border-emerald-500'
                        }`}
                      >
                        <CheckCircle2 className="h-4 w-4" strokeWidth={1.75} />
                        {attended ? 'Attended' : 'Mark Attended'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}

        {/* TAB 3: EARNINGS & RETENTION */}
        {activeTab === 'earnings' ? (
          <section className="grid gap-4 sm:grid-cols-3">
            <div className="va-card rounded-2xl p-5">
              <p className="text-xs font-bold text-chrome">
                Published &amp; Completed Slots
              </p>
              <p className="font-display mt-2 text-4xl font-extrabold text-chalk tabular-nums">
                {earningsStats.totalSlots}{' '}
                <span className="text-lg text-chrome">
                  ({earningsStats.completedCount} done)
                </span>
              </p>
            </div>
            <div className="va-card rounded-2xl p-5">
              <p className="text-xs font-bold text-chrome">
                Confirmed Client Bookings
              </p>
              <p className="font-display mt-2 flex items-center gap-2 text-4xl font-extrabold text-amber-400 tabular-nums">
                <Users className="h-7 w-7" strokeWidth={1.75} />
                {earningsStats.totalAttendeeSpots}
              </p>
            </div>
            <div className="va-card overflow-hidden rounded-2xl">
              <div className="va-led-rule w-full" />
              <div className="p-5">
                <p className="text-xs font-bold text-silver">
                  Estimated Payout ({BUSINESS_RULES.DEFAULT_TRAINER_COMMISSION_PCT}% Split)
                </p>
                <p className="font-display mt-2 text-4xl font-extrabold text-emerald-400 tabular-nums">
                  {formatBdt(earningsStats.commissionBdt)}
                </p>
                <p className="mt-1 text-xs text-chrome tabular-nums">
                  Gross Session Value: {formatBdt(earningsStats.grossEstimatedBdt)}
                </p>
              </div>
            </div>
          </section>
        ) : null}
      </main>

      {/* Create / Edit Slot Modal */}
      <Modal
        open={slotModalOpen}
        onClose={() => setSlotModalOpen(false)}
        title={editingSession ? 'Edit Training Slot' : 'Publish New Training Slot'}
        subtitle="System validates trainer & zone overlap automatically"
      >
        <form onSubmit={handleSaveSlot} className="space-y-3.5">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-chrome">Session Title</span>
            <input
              type="text"
              required
              minLength={3}
              value={slotTitle}
              onChange={(e) => setSlotTitle(e.target.value)}
              className="min-h-12 w-full rounded-xl border border-steel bg-obsidian px-3.5 text-sm text-chalk"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-chrome">Branch</span>
              <select
                value={slotBranchId}
                onChange={(e) => setSlotBranchId(e.target.value)}
                className="min-h-12 w-full rounded-xl border border-steel bg-obsidian px-3 text-sm text-chalk"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} · {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-chrome">Type</span>
              <select
                value={slotType}
                onChange={(e) => setSlotType(e.target.value as SessionType)}
                className="min-h-12 w-full rounded-xl border border-steel bg-obsidian px-3 text-sm text-chalk"
              >
                <option value={SessionType.PERSONAL_TRAINING}>1-on-1 PT</option>
                <option value={SessionType.GROUP_CLASS}>Group Class</option>
                <option value={SessionType.OPEN_AVAILABILITY}>Open Availability</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-chrome">Zone</span>
              <input
                type="text"
                value={slotZone}
                onChange={(e) => setSlotZone(e.target.value)}
                className="min-h-12 w-full rounded-xl border border-steel bg-obsidian px-3.5 text-sm text-chalk"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-chrome">
                Max Capacity
              </span>
              <input
                type="number"
                min={1}
                max={100}
                required
                value={slotCapacity}
                onChange={(e) => setSlotCapacity(e.target.value)}
                className="min-h-12 w-full rounded-xl border border-steel bg-obsidian px-3.5 text-sm font-bold text-chalk"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-chrome">Start Time</span>
              <input
                type="datetime-local"
                required
                value={slotStart}
                onChange={(e) => setSlotStart(e.target.value)}
                className="min-h-12 w-full rounded-xl border border-steel bg-obsidian px-3 text-xs text-chalk"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-chrome">End Time</span>
              <input
                type="datetime-local"
                required
                value={slotEnd}
                onChange={(e) => setSlotEnd(e.target.value)}
                className="min-h-12 w-full rounded-xl border border-steel bg-obsidian px-3 text-xs text-chalk"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="flex min-h-12 w-full items-center justify-center rounded-xl bg-crimson text-sm font-bold uppercase tracking-wider text-chalk hover:bg-crimson-hover disabled:opacity-50"
          >
            {submitting ? 'Saving...' : editingSession ? 'Update Slot' : 'Create Slot'}
          </button>
        </form>
      </Modal>

      {/* Booked-Slot Cancel Reason Modal */}
      <Modal
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        title="Cancel Booked Training Slot"
        subtitle={
          cancelTarget
            ? `${cancelTarget.confirmedCount} member(s) booked — refunds credits & sends apology alert`
            : undefined
        }
      >
        <form onSubmit={handleConfirmBookedCancel} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-chrome">
              Mandatory Cancellation Reason (Min 5 Chars) *
            </span>
            <textarea
              required
              minLength={5}
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Coach emergency / equipment safety maintenance..."
              className="w-full rounded-xl border border-steel bg-obsidian p-3 text-sm text-chalk outline-none focus:border-crimson"
            />
          </label>
          <button
            type="submit"
            disabled={submitting || cancelReason.trim().length < 5}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#FF2A3B] text-sm font-bold uppercase text-white hover:bg-red-600 disabled:opacity-50"
          >
            <AlertTriangle className="h-4 w-4" strokeWidth={1.75} />
            {submitting ? 'Cancelling...' : 'Confirm Cancel & Refund Credits'}
          </button>
        </form>
      </Modal>

      <ToastBanner toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
