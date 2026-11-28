'use client';

import {
  AccessVerifyResult,
  BRANCH_CODES,
  ManualOverrideSchema,
} from '@vintage/shared';
import {
  AlertTriangle,
  Camera,
  CameraOff,
  CheckCircle2,
  Cpu,
  KeyRound,
  Lock,
  LockOpen,
  QrCode,
  Radio,
  RefreshCw,
  ShieldAlert,
  Upload,
  Wifi,
  WifiOff,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { BrandCrest } from '@/components/ui/BrandCrest';
import {
  QueuedOfflineEvent,
  enqueueOfflineEvent,
  listOfflineEvents,
  removeOfflineEvents,
} from './offlineQueue';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:4000';

interface BranchItem {
  id: string;
  name: string;
  code: string;
  address?: string;
  maxOccupancy?: number;
  currentOccupancy?: number;
  edgeNodeOnline?: boolean;
}

interface LockerItem {
  id: string;
  branchId: string;
  lockerNumber: string;
  hardwareRelayId: string;
  assignedUserId: string | null;
  assignedUserName?: string | null;
  claimedAt?: string | null;
}

interface EquipmentLookup {
  id: string;
  branchId: string;
  qrCodeToken: string;
  name: string;
  zoneName: string;
  status: string;
}

type SimulatorConsoleTab = 'TURNSTILE' | 'LOCKERS' | 'QR_SCANNER';

const FALLBACK_BRANCHES: BranchItem[] = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    name: 'Gulshan-1 Flagship',
    code: BRANCH_CODES.GULSHAN,
    address: 'Road 12, Gulshan-1, Dhaka 1212',
    maxOccupancy: 80,
    currentOccupancy: 42,
    edgeNodeOnline: true,
  },
  {
    id: '10000000-0000-4000-8000-000000000002',
    name: 'Dhanmondi Iron Club',
    code: BRANCH_CODES.DHANMONDI,
    address: 'Satmasjid Road, Dhanmondi 27, Dhaka 1209',
    maxOccupancy: 70,
    currentOccupancy: 28,
    edgeNodeOnline: true,
  },
  {
    id: '10000000-0000-4000-8000-000000000003',
    name: 'Uttara Sector-7 Studio',
    code: BRANCH_CODES.UTTARA,
    address: 'Road 18, Sector 7, Uttara, Dhaka 1230',
    maxOccupancy: 60,
    currentOccupancy: 19,
    edgeNodeOnline: true,
  },
];

const SEEDED_CARDS = [
  {
    uid: 'VA-RFID-4092',
    label: 'Farhana Islam',
    tag: 'Active VIP (3-Branch)',
    tone: 'ok',
  },
  {
    uid: 'VA-RFID-4093',
    label: 'Rayhan Islam',
    tag: 'Family Dependent',
    tone: 'ok',
  },
  {
    uid: 'VA-RFID-8841',
    label: 'Tariq Hasan',
    tag: 'Overdue Unpaid (3,500 BDT)',
    tone: 'denied',
  },
  {
    uid: 'VA-RFID-5510',
    label: 'Kamrul Islam',
    tag: 'Partial Due (1,750 BDT)',
    tone: 'warn',
  },
  {
    uid: 'VA-RFID-7721',
    label: 'Nusrat Jahan',
    tag: 'Frozen Account',
    tone: 'denied',
  },
  {
    uid: 'VA-RFID-LOST-99',
    label: 'Lost / Revoked Card',
    tag: 'Revoked UID',
    tone: 'denied',
  },
] as const;

const FALLBACK_LOCKERS: LockerItem[] = Array.from({ length: 6 }, (_, i) => ({
  id: `fallback-locker-${i + 1}`,
  branchId: FALLBACK_BRANCHES[0].id,
  lockerNumber: `G-0${i + 1}`,
  hardwareRelayId: `RELAY-DHK01-L${i + 1}`,
  assignedUserId: i === 0 ? '30000000-0000-4000-8000-000000000006' : null,
  assignedUserName: i === 0 ? 'Farhana Islam' : null,
}));

export default function HardwareSimulatorPage() {
  const [branches, setBranches] = useState<BranchItem[]>(FALLBACK_BRANCHES);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    FALLBACK_BRANCHES[0].id,
  );
  const [consoleTab, setConsoleTab] = useState<SimulatorConsoleTab>('TURNSTILE');
  const [offlineMode, setOfflineMode] = useState(false);
  const [queuedEvents, setQueuedEvents] = useState<QueuedOfflineEvent[]>([]);
  const [syncBanner, setSyncBanner] = useState<string | null>(null);

  const [customCardUid, setCustomCardUid] = useState('');
  const [activeCardUid, setActiveCardUid] = useState('VA-RFID-4092');
  const [gateState, setGateState] = useState<
    'IDLE' | 'UNLOCKED' | 'DENIED' | 'OFFLINE_QUEUED'
  >('IDLE');
  const [lastResult, setLastResult] = useState<AccessVerifyResult | null>(null);
  const [tapHistory, setTapHistory] = useState<
    Array<{
      id: string;
      label: string;
      status: string;
      allowed: boolean;
      latencyMs: number;
      time: string;
    }>
  >([]);
  const [isTapping, setIsTapping] = useState(false);

  // Offline Manual Override Form
  const [overrideUserId, setOverrideUserId] = useState(
    '30000000-0000-4000-8000-000000000008',
  );
  const [overrideReason, setOverrideReason] = useState<
    'Promised to pay tomorrow' | 'Card reader glitch' | 'Admin approved'
  >('Promised to pay tomorrow');
  const [overrideNotes, setOverrideNotes] = useState(
    'Offline gate check: member promised settlement at reception.',
  );

  // Smart Lockers
  const [lockers, setLockers] = useState<LockerItem[]>(FALLBACK_LOCKERS);
  const [lockerStatusMsg, setLockerStatusMsg] = useState<string | null>(null);

  // QR Scanner & Broken Equipment Reporter
  const [qrMode, setQrMode] = useState<'MEMBER_PASS' | 'EQUIPMENT_REPORT'>(
    'EQUIPMENT_REPORT',
  );
  const [qrTokenInput, setQrTokenInput] = useState('VA-EQ-DHK01-TM04');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [equipmentAsset, setEquipmentAsset] = useState<EquipmentLookup | null>(
    null,
  );
  const [ticketDescription, setTicketDescription] = useState('');
  const [ticketPhoto, setTicketPhoto] = useState<File | null>(null);
  const [ticketNotice, setTicketNotice] = useState<string | null>(null);

  const qrScannerRef = useRef<{
    stop: () => Promise<void>;
    clear: () => void;
  } | null>(null);

  const refreshQueue = useCallback(async (branchId: string) => {
    const items = await listOfflineEvents(branchId);
    setQueuedEvents(items);
  }, []);

  const fetchBranches = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/branches`, {
        credentials: 'include',
      });
      if (!res.ok) return;
      const data = (await res.json()) as BranchItem[];
      if (Array.isArray(data) && data.length > 0) {
        setBranches(data);
        setSelectedBranchId((prev) =>
          data.some((b) => b.id === prev) ? prev : data[0].id,
        );
      }
    } catch {
      // Keep deterministic fallback branches when API is offline
    }
  }, []);

  const fetchLockers = useCallback(async (branchId: string) => {
    try {
      const res = await fetch(
        `${API_BASE}/api/facility/lockers?branchId=${encodeURIComponent(branchId)}`,
        { credentials: 'include' },
      );
      if (!res.ok) return;
      const data = (await res.json()) as LockerItem[];
      if (Array.isArray(data) && data.length > 0) {
        setLockers(data);
      }
    } catch {
      // Keep fallback lockers if API offline
    }
  }, []);

  useEffect(() => {
    void fetchBranches();
  }, [fetchBranches]);

  useEffect(() => {
    void refreshQueue(selectedBranchId);
    void fetchLockers(selectedBranchId);
  }, [selectedBranchId, refreshQueue, fetchLockers]);

  useEffect(() => {
    return () => {
      if (qrScannerRef.current) {
        void qrScannerRef.current.stop().catch(() => undefined);
      }
    };
  }, []);

  const reconcileOfflineQueue = useCallback(
    async (branchId: string) => {
      const pending = await listOfflineEvents(branchId);
      if (pending.length === 0) {
        setSyncBanner('Edge node online. Zero pending offline events.');
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/access/offline-sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            branchId,
            events: pending.map((ev) => ({
              id: ev.id,
              kind: ev.kind,
              cardUid: ev.cardUid,
              userId: ev.userId,
              scannedAt: ev.scannedAt,
              overrideReason: ev.overrideReason,
              overrideNotes: ev.overrideNotes,
            })),
          }),
        });

        if (!res.ok) {
          throw new Error(`Sync returned HTTP ${res.status}`);
        }

        await removeOfflineEvents(pending.map((p) => p.id));
        await refreshQueue(branchId);
        setSyncBanner(
          `Reconciled ${pending.length} queued offline event(s) with zero duplicates.`,
        );
      } catch (err) {
        setSyncBanner(
          `Offline sync deferred (${err instanceof Error ? err.message : 'API unreachable'}). Items remain safe in IndexedDB.`,
        );
      }
    },
    [refreshQueue],
  );

  async function toggleOfflineOutage() {
    const nextOffline = !offlineMode;
    setOfflineMode(nextOffline);
    setSyncBanner(null);

    try {
      await fetch(
        `${API_BASE}/api/branches/${encodeURIComponent(selectedBranchId)}/edge-status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ edgeNodeOnline: !nextOffline }),
        },
      );
    } catch {
      // Simulator continues operating locally even if API is down
    }

    if (!nextOffline) {
      await reconcileOfflineQueue(selectedBranchId);
    }
  }

  async function handleCardTap(cardUid: string) {
    const cleanUid = cardUid.trim();
    if (!cleanUid) return;

    setActiveCardUid(cleanUid);
    setIsTapping(true);
    const nowIso = new Date().toISOString();
    const clientEventId = crypto.randomUUID();

    if (offlineMode) {
      const queued: QueuedOfflineEvent = {
        id: clientEventId,
        branchId: selectedBranchId,
        kind: 'CARD_TAP',
        cardUid: cleanUid,
        scannedAt: nowIso,
      };
      await enqueueOfflineEvent(queued);
      await refreshQueue(selectedBranchId);

      setGateState('OFFLINE_QUEUED');
      setLastResult({
        allowed: true,
        entryStatus: 'ALLOWED',
        attendanceLogId: clientEventId,
        branchId: selectedBranchId,
        reason: `Edge Outage Active — Buffered ${cleanUid} locally in IndexedDB (${clientEventId.slice(0, 8)})`,
        latencyMs: 3,
        scannedAt: nowIso,
      });
      setTapHistory((prev) => [
        {
          id: clientEventId,
          label: cleanUid,
          status: 'QUEUED_OFFLINE',
          allowed: true,
          latencyMs: 3,
          time: new Date().toLocaleTimeString(),
        },
        ...prev.slice(0, 7),
      ]);
      setIsTapping(false);
      return;
    }

    const t0 = performance.now();
    try {
      const res = await fetch(`${API_BASE}/api/access/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          branchId: selectedBranchId,
          cardUid: cleanUid,
          clientEventId,
          scannedAt: nowIso,
        }),
      });

      const latency = Math.round(performance.now() - t0);
      if (!res.ok) {
        const errBody = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(errBody?.message || `HTTP ${res.status}`);
      }

      const data = (await res.json()) as AccessVerifyResult;
      setLastResult(data);
      setGateState(data.allowed ? 'UNLOCKED' : 'DENIED');
      setTapHistory((prev) => [
        {
          id: data.attendanceLogId || clientEventId,
          label: data.memberName ? `${cleanUid} (${data.memberName})` : cleanUid,
          status: data.entryStatus,
          allowed: data.allowed,
          latencyMs: data.latencyMs ?? latency,
          time: new Date().toLocaleTimeString(),
        },
        ...prev.slice(0, 7),
      ]);
    } catch (err) {
      setGateState('DENIED');
      setLastResult({
        allowed: false,
        entryStatus: 'DENIED_EXPIRED',
        attendanceLogId: clientEventId,
        branchId: selectedBranchId,
        reason:
          err instanceof Error
            ? `Gate Fail-Closed: ${err.message}`
            : 'Gate Fail-Closed: Verification error',
        latencyMs: Math.round(performance.now() - t0),
        scannedAt: nowIso,
      });
    } finally {
      setIsTapping(false);
    }
  }

  async function handleQueueOfflineOverride(e: FormEvent) {
    e.preventDefault();
    const parsed = ManualOverrideSchema.safeParse({
      userId: overrideUserId,
      branchId: selectedBranchId,
      reason: overrideReason,
      notes: overrideNotes,
    });

    if (!parsed.success) {
      setSyncBanner(
        parsed.error.issues[0]?.message || 'Invalid override parameters',
      );
      return;
    }

    const eventId = crypto.randomUUID();
    await enqueueOfflineEvent({
      id: eventId,
      branchId: selectedBranchId,
      kind: 'MANUAL_OVERRIDE',
      userId: parsed.data.userId,
      scannedAt: new Date().toISOString(),
      overrideReason: parsed.data.reason,
      overrideNotes: parsed.data.notes,
    });
    await refreshQueue(selectedBranchId);
    setGateState('OFFLINE_QUEUED');
    setSyncBanner(`Queued offline Manual Override (${eventId.slice(0, 8)}).`);
  }

  async function handleLockerTap(locker: LockerItem) {
    setLockerStatusMsg(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/facility/lockers/${encodeURIComponent(locker.id)}/tap`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ cardUid: activeCardUid }),
        },
      );

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(err?.message || `HTTP ${res.status}`);
      }

      const updated = (await res.json()) as {
        message?: string;
        locker?: LockerItem;
      };
      setLockerStatusMsg(
        updated.message ||
          `Relay ${locker.hardwareRelayId} pulsed for ${locker.lockerNumber} (${activeCardUid}).`,
      );
      await fetchLockers(selectedBranchId);
    } catch (err) {
      setLockerStatusMsg(
        `Locker ${locker.lockerNumber}: ${err instanceof Error ? err.message : 'Tap failed'}`,
      );
    }
  }

  const processQrToken = useCallback(
    async (token: string) => {
      const cleanToken = token.trim();
      if (!cleanToken) return;
      setQrTokenInput(cleanToken);
      setTicketNotice(null);

      if (qrMode === 'MEMBER_PASS') {
        try {
          const res = await fetch(`${API_BASE}/api/access/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              branchId: selectedBranchId,
              qrToken: cleanToken,
              clientEventId: crypto.randomUUID(),
            }),
          });
          const data = (await res.json()) as AccessVerifyResult;
          setLastResult(data);
          setGateState(data.allowed ? 'UNLOCKED' : 'DENIED');
        } catch (err) {
          setGateState('DENIED');
          setTicketNotice(
            err instanceof Error ? err.message : 'QR verification failed',
          );
        }
        return;
      }

      // Broken Equipment QR Lookup
      try {
        const res = await fetch(
          `${API_BASE}/api/facility/equipment/qr/${encodeURIComponent(cleanToken)}`,
          { credentials: 'include' },
        );
        if (!res.ok) {
          throw new Error(`Equipment QR "${cleanToken}" not found (${res.status})`);
        }
        const asset = (await res.json()) as EquipmentLookup;
        setEquipmentAsset(asset);
      } catch (err) {
        setEquipmentAsset(null);
        setTicketNotice(
          err instanceof Error
            ? err.message
            : 'Unable to resolve equipment QR token.',
        );
      }
    },
    [qrMode, selectedBranchId],
  );

  async function toggleWebcamScanner() {
    setCameraError(null);
    if (cameraActive && qrScannerRef.current) {
      await qrScannerRef.current.stop().catch(() => undefined);
      qrScannerRef.current.clear();
      qrScannerRef.current = null;
      setCameraActive(false);
      return;
    }

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('va-qr-reader');
      qrScannerRef.current = scanner;
      setCameraActive(true);

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          void processQrToken(decodedText);
          void scanner.stop().catch(() => undefined);
          setCameraActive(false);
        },
        () => undefined,
      );
    } catch (err) {
      setCameraActive(false);
      setCameraError(
        err instanceof Error
          ? `Webcam unavailable: ${err.message}. Use manual QR token input below.`
          : 'Webcam unavailable. Use manual QR token input below.',
      );
    }
  }

  async function handleTicketSubmit(e: FormEvent) {
    e.preventDefault();
    setTicketNotice(null);
    const cleanDesc = ticketDescription.trim();
    if (cleanDesc.length < 5) {
      setTicketNotice('Please provide a description of at least 5 characters.');
      return;
    }

    try {
      let res: Response;
      if (ticketPhoto) {
        const formData = new FormData();
        if (equipmentAsset?.id) formData.append('equipmentId', equipmentAsset.id);
        formData.append('qrCodeToken', qrTokenInput.trim());
        formData.append('description', cleanDesc);
        formData.append('photo', ticketPhoto);

        res = await fetch(`${API_BASE}/api/facility/tickets`, {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
      } else {
        res = await fetch(`${API_BASE}/api/facility/tickets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            equipmentId: equipmentAsset?.id,
            qrCodeToken: qrTokenInput.trim(),
            description: cleanDesc,
          }),
        });
      }

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(err?.message || `HTTP ${res.status}`);
      }

      setTicketDescription('');
      setTicketPhoto(null);
      setTicketNotice(
        `Ticket submitted for ${equipmentAsset?.name ?? qrTokenInput}. Equipment flagged OUT_OF_ORDER on Trainer & Desk boards.`,
      );
      await processQrToken(qrTokenInput);
    } catch (err) {
      setTicketNotice(
        `Ticket error: ${err instanceof Error ? err.message : 'Unable to submit ticket'}`,
      );
    }
  }

  const activeBranch =
    branches.find((b) => b.id === selectedBranchId) ?? branches[0];

  return (
    <main className="min-h-screen bg-obsidian pb-24 text-chalk md:pb-12">
      {/* Persistent Offline Mode Banner */}
      {offlineMode && (
        <div
          role="status"
          data-testid="offline-mode-banner"
          className="border-b border-access-warn/60 bg-access-warn/15 px-6 py-3 text-access-warn"
        >
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-sm font-semibold">
            <div className="flex items-center gap-2">
              <WifiOff className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              <span>
                Offline Mode — Local Queue Active ({activeBranch?.code}):{' '}
                {queuedEvents.length} event(s) buffered in IndexedDB
              </span>
            </div>
            <span className="text-xs uppercase tracking-wider">
              Toggle Online to Auto-Reconcile
            </span>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 md:px-8">
        {/* Unified Branch & Outage Header Bar */}
        <header className="overflow-hidden rounded-2xl border border-steel bg-iron">
          <div className="va-led-rule w-full" />
          <div className="flex flex-col justify-between gap-5 p-5 lg:flex-row lg:items-center">
            <div className="flex items-center gap-4">
              <Link href="/" aria-label="Back to Storefront">
                <BrandCrest size={52} />
              </Link>
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-chrome">
                  <Cpu className="h-3.5 w-3.5 text-crimson" strokeWidth={1.75} />
                  <span>Virtual Hardware &amp; Edge Simulator</span>
                </div>
                <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight text-chalk md:text-4xl">
                  Turnstile, Lockers &amp; QR Console
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-xs text-chrome">
                <span className="font-semibold">Active Branch</span>
                <select
                  aria-label="Branch selector"
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="min-h-11 rounded-xl border border-steel bg-obsidian px-3 text-sm font-semibold text-chalk focus:border-crimson focus:outline-none"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} — {b.name}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={() => void toggleOfflineOutage()}
                data-testid="toggle-offline-btn"
                className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold uppercase tracking-wider transition ${
                  offlineMode
                    ? 'border-access-warn bg-access-warn/20 text-access-warn hover:bg-access-warn/30'
                    : 'border-access-ok/50 bg-access-ok/15 text-access-ok hover:bg-access-ok/25'
                }`}
              >
                {offlineMode ? (
                  <>
                    <WifiOff className="h-4 w-4" strokeWidth={1.75} />
                    Restore Internet ({queuedEvents.length} queued)
                  </>
                ) : (
                  <>
                    <Wifi className="h-4 w-4" strokeWidth={1.75} />
                    Simulate Internet Outage
                  </>
                )}
              </button>

              <Link
                href="/dev-inbox"
                className="inline-flex min-h-11 items-center rounded-xl border border-steel bg-obsidian px-4 py-2 text-xs font-semibold uppercase tracking-wider text-silver transition hover:border-crimson hover:text-chalk"
              >
                Dev Inbox
              </Link>
            </div>
          </div>
        </header>

        {/* Persistent Compact Gate Telemetry Strip */}
        <section
          aria-label="Live Gate Telemetry"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-steel bg-iron px-4 py-3 text-xs"
        >
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-bold uppercase ${
                gateState === 'UNLOCKED'
                  ? 'border-access-ok/50 bg-access-ok/15 text-access-ok'
                  : gateState === 'DENIED'
                    ? 'border-access-denied/60 bg-access-denied/15 text-access-denied'
                    : gateState === 'OFFLINE_QUEUED'
                      ? 'border-access-warn/50 bg-access-warn/15 text-access-warn'
                      : 'border-steel bg-obsidian text-chrome'
              }`}
            >
              {gateState === 'UNLOCKED' ? (
                <LockOpen className="h-3.5 w-3.5" strokeWidth={1.75} />
              ) : gateState === 'DENIED' ? (
                <Lock className="h-3.5 w-3.5" strokeWidth={1.75} />
              ) : gateState === 'OFFLINE_QUEUED' ? (
                <WifiOff className="h-3.5 w-3.5" strokeWidth={1.75} />
              ) : (
                <ShieldAlert className="h-3.5 w-3.5" strokeWidth={1.75} />
              )}
              Gate: {gateState}
            </span>

            <span className="whitespace-nowrap rounded-lg border border-steel bg-obsidian px-2.5 py-1 font-mono text-silver">
              UID: <strong className="text-chalk">{activeCardUid}</strong>
            </span>
          </div>

          <div className="flex items-center gap-3 text-chrome tabular-nums">
            <span className="truncate max-w-[260px] sm:max-w-md">
              {lastResult ? lastResult.reason : 'Ready for RFID tap or QR scan'}
            </span>
            {lastResult ? (
              <span className="font-mono font-semibold text-silver">
                {lastResult.latencyMs}ms
              </span>
            ) : null}
          </div>
        </section>

        {syncBanner && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-steel bg-iron px-4 py-3 text-sm text-silver">
            <span>{syncBanner}</span>
            {!offlineMode && queuedEvents.length > 0 && (
              <button
                type="button"
                onClick={() => void reconcileOfflineQueue(selectedBranchId)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-crimson px-3 py-1.5 text-xs font-bold uppercase text-chalk"
              >
                <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />
                Retry Sync
              </button>
            )}
          </div>
        )}

        {/* Segmented Console Tabs */}
        <div
          role="tablist"
          aria-label="Hardware Console Modules"
          className="grid grid-cols-3 gap-2 rounded-2xl border border-steel bg-iron p-1.5"
        >
          {(
            [
              { id: 'TURNSTILE', label: 'Turnstile & RFID', icon: Radio },
              { id: 'LOCKERS', label: 'Smart Lockers', icon: KeyRound },
              { id: 'QR_SCANNER', label: 'QR & Asset Reporter', icon: QrCode },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = consoleTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setConsoleTab(tab.id)}
                className={`flex min-h-[46px] items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold uppercase tracking-wider transition-colors ${
                  active ? 'bg-crimson text-chalk' : 'text-chrome hover:text-chalk'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* CONSOLE TAB 1: TURNSTILE & RFID */}
        {consoleTab === 'TURNSTILE' ? (
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Left: Seeded RFID Tap Pad */}
            <section className="va-card space-y-5 rounded-2xl p-6 lg:col-span-7">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display flex items-center gap-2 text-2xl font-bold uppercase text-chalk">
                  <Radio className="h-5 w-5 text-crimson" strokeWidth={1.75} />
                  RFID Turnstile Reader
                </h2>
                <span className="whitespace-nowrap rounded-full border border-steel bg-obsidian px-3 py-1 text-xs text-chrome">
                  Selected UID: <strong className="font-mono text-chalk">{activeCardUid}</strong>
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {SEEDED_CARDS.map((card) => {
                  const badgeTone =
                    card.tone === 'ok'
                      ? 'text-access-ok border-access-ok/30 bg-access-ok/10'
                      : card.tone === 'warn'
                        ? 'text-access-warn border-access-warn/30 bg-access-warn/10'
                        : 'text-access-denied border-access-denied/30 bg-access-denied/10';
                  return (
                    <button
                      key={card.uid}
                      type="button"
                      disabled={isTapping}
                      onClick={() => void handleCardTap(card.uid)}
                      className="flex min-h-[72px] flex-col justify-between rounded-xl border border-steel bg-obsidian p-3.5 text-left transition hover:border-crimson disabled:opacity-60"
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="whitespace-nowrap font-mono text-xs font-bold text-chalk">
                          {card.uid}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badgeTone}`}
                        >
                          {card.tag}
                        </span>
                      </div>
                      <span className="mt-1.5 text-sm font-medium text-silver">
                        {card.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Card UID Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleCardTap(customCardUid);
                }}
                className="flex flex-col gap-2 sm:flex-row"
              >
                <input
                  type="text"
                  value={customCardUid}
                  onChange={(e) => setCustomCardUid(e.target.value)}
                  placeholder="Enter custom Card UID (e.g., VA-RFID-2104)"
                  aria-label="Custom RFID Card UID"
                  className="min-h-[46px] flex-1 rounded-xl border border-steel bg-obsidian px-3.5 text-sm text-chalk placeholder:text-chrome/60 focus:border-crimson focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isTapping || !customCardUid.trim()}
                  className="min-h-[46px] rounded-xl bg-crimson px-5 text-xs font-bold uppercase tracking-wider text-chalk transition hover:bg-crimson-hover disabled:opacity-50"
                >
                  Tap Custom Card
                </button>
              </form>

              {/* Offline Override Simulator */}
              {offlineMode && (
                <form
                  onSubmit={handleQueueOfflineOverride}
                  className="space-y-3 rounded-xl border border-access-warn/40 bg-access-warn/5 p-4"
                >
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-access-warn">
                    <AlertTriangle className="h-4 w-4" strokeWidth={1.75} />
                    Queue Offline Manual Override (Reconciles on Reconnect)
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <select
                      value={overrideUserId}
                      onChange={(e) => setOverrideUserId(e.target.value)}
                      aria-label="Member for offline override"
                      className="min-h-[42px] rounded-lg border border-steel bg-obsidian px-3 text-xs text-chalk"
                    >
                      <option value="30000000-0000-4000-8000-000000000008">
                        Tariq Hasan (Overdue)
                      </option>
                      <option value="30000000-0000-4000-8000-000000000009">
                        Kamrul Islam (Partial)
                      </option>
                      <option value="30000000-0000-4000-8000-000000000010">
                        Nusrat Jahan (Frozen)
                      </option>
                    </select>
                    <select
                      value={overrideReason}
                      onChange={(e) =>
                        setOverrideReason(
                          e.target.value as
                            | 'Promised to pay tomorrow'
                            | 'Card reader glitch'
                            | 'Admin approved',
                        )
                      }
                      aria-label="Override reason"
                      className="min-h-[42px] rounded-lg border border-steel bg-obsidian px-3 text-xs text-chalk"
                    >
                      <option value="Promised to pay tomorrow">
                        Promised to pay tomorrow
                      </option>
                      <option value="Card reader glitch">Card reader glitch</option>
                      <option value="Admin approved">Admin approved</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={overrideNotes}
                      onChange={(e) => setOverrideNotes(e.target.value)}
                      minLength={10}
                      placeholder="Mandatory >= 10 char justification note"
                      className="min-h-[42px] flex-1 rounded-lg border border-steel bg-obsidian px-3 text-xs text-chalk"
                    />
                    <button
                      type="submit"
                      className="min-h-[42px] rounded-lg border border-access-warn bg-access-warn/20 px-4 text-xs font-bold uppercase text-access-warn hover:bg-access-warn/30"
                    >
                      Queue Override
                    </button>
                  </div>
                </form>
              )}
            </section>

            {/* Right: Animated Virtual Turnstile Gate */}
            <section className="va-card flex flex-col justify-between rounded-2xl p-6 lg:col-span-5">
              <div>
                <h2 className="font-display text-2xl font-bold uppercase text-chalk">
                  Virtual Turnstile Gate ({activeBranch?.code})
                </h2>
                <p className="mt-1 text-xs text-chrome">
                  Real-time optical barrier &amp; fail-closed decision engine
                </p>

                <div
                  data-testid="virtual-turnstile-gate"
                  className={`mt-5 rounded-2xl border-2 p-6 text-center transition-colors duration-200 ${
                    gateState === 'UNLOCKED'
                      ? 'border-access-ok bg-access-ok/10'
                      : gateState === 'DENIED'
                        ? 'border-access-denied bg-access-denied/10'
                        : gateState === 'OFFLINE_QUEUED'
                          ? 'border-access-warn bg-access-warn/10'
                          : 'border-steel bg-obsidian'
                  }`}
                >
                  <div className="mx-auto flex h-24 w-full max-w-[260px] items-center justify-between px-4">
                    <div className="h-16 w-4 rounded bg-steel" />
                    <div className="flex flex-1 items-center justify-center">
                      {gateState === 'UNLOCKED' ? (
                        <div className="flex flex-col items-center gap-1 text-access-ok">
                          <LockOpen className="h-10 w-10" strokeWidth={1.75} />
                          <span className="font-display text-xl font-extrabold uppercase tracking-wider">
                            Gate Unlocked
                          </span>
                        </div>
                      ) : gateState === 'DENIED' ? (
                        <div className="flex flex-col items-center gap-1 text-access-denied">
                          <div className="relative">
                            <Lock className="h-10 w-10" strokeWidth={1.75} />
                            <span
                              aria-hidden="true"
                              className="absolute -top-1 -right-1 flex h-3 w-3"
                            >
                              <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-access-denied opacity-75" />
                              <span className="relative inline-flex h-3 w-3 rounded-full bg-access-denied" />
                            </span>
                          </div>
                          <span className="font-display text-xl font-extrabold uppercase tracking-wider">
                            Access Denied
                          </span>
                        </div>
                      ) : gateState === 'OFFLINE_QUEUED' ? (
                        <div className="flex flex-col items-center gap-1 text-access-warn">
                          <WifiOff className="h-10 w-10" strokeWidth={1.75} />
                          <span className="font-display text-xl font-extrabold uppercase tracking-wider">
                            Buffered Local
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-chrome">
                          <ShieldAlert className="h-10 w-10" strokeWidth={1.75} />
                          <span className="font-display text-lg font-bold uppercase tracking-wider">
                            Standby — Tap Card
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="h-16 w-4 rounded bg-steel" />
                  </div>

                  {/* Gate Barriers Animation */}
                  <div className="mx-auto mt-3 flex max-w-[220px] items-center justify-between gap-2">
                    <div
                      className={`h-2 flex-1 origin-left rounded-full transition-transform duration-300 ${
                        gateState === 'UNLOCKED' || gateState === 'OFFLINE_QUEUED'
                          ? '-rotate-45 bg-access-ok'
                          : gateState === 'DENIED'
                            ? 'rotate-0 bg-access-denied'
                            : 'rotate-0 bg-steel'
                      }`}
                    />
                    <div
                      className={`h-2 flex-1 origin-right rounded-full transition-transform duration-300 ${
                        gateState === 'UNLOCKED' || gateState === 'OFFLINE_QUEUED'
                          ? 'rotate-45 bg-access-ok'
                          : gateState === 'DENIED'
                            ? 'rotate-0 bg-access-denied'
                            : 'rotate-0 bg-steel'
                      }`}
                    />
                  </div>

                  {lastResult && (
                    <div className="mt-5 space-y-1.5 border-t border-steel pt-4 text-left text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold uppercase tracking-wider text-chalk">
                          {lastResult.entryStatus}
                        </span>
                        <span className="font-mono text-chrome tabular-nums">
                          {lastResult.latencyMs} ms
                        </span>
                      </div>
                      {lastResult.memberName && (
                        <p className="text-sm font-semibold text-chalk">
                          {lastResult.memberName}{' '}
                          {lastResult.planName ? `· ${lastResult.planName}` : ''}
                        </p>
                      )}
                      <p className="text-silver">{lastResult.reason}</p>
                      {typeof lastResult.dueAmountBdt === 'number' &&
                        lastResult.dueAmountBdt > 0 && (
                          <p className="font-bold text-access-denied tabular-nums">
                            Outstanding Balance: {lastResult.dueAmountBdt} BDT
                          </p>
                        )}
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Simulator Taps */}
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold text-chrome">
                  Recent Gate Telemetry
                </p>
                {tapHistory.length === 0 ? (
                  <p className="text-xs text-chrome/70">
                    No taps simulated yet in this session.
                  </p>
                ) : (
                  <ul className="space-y-1.5 text-xs">
                    {tapHistory.slice(0, 4).map((item) => (
                      <li
                        key={`${item.id}-${item.time}`}
                        className="flex items-center justify-between rounded-lg border border-steel bg-obsidian px-3 py-1.5"
                      >
                        <span className="truncate font-mono text-silver">
                          {item.label}
                        </span>
                        <span
                          className={`font-semibold tabular-nums ${
                            item.allowed ? 'text-access-ok' : 'text-access-denied'
                          }`}
                        >
                          {item.status} ({item.latencyMs}ms)
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>
        ) : null}

        {/* CONSOLE TAB 2: SMART LOCKERS */}
        {consoleTab === 'LOCKERS' ? (
          <section className="va-card space-y-4 rounded-2xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display flex items-center gap-2 text-2xl font-bold uppercase text-chalk">
                <KeyRound className="h-5 w-5 text-crimson" strokeWidth={1.75} />
                Smart Locker Grid ({activeBranch?.code})
              </h2>
              <span className="whitespace-nowrap rounded-full border border-steel bg-obsidian px-3 py-1 text-xs text-chrome">
                Tap with: <strong className="font-mono text-chalk">{activeCardUid}</strong>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
              {lockers.map((locker) => {
                const occupied = Boolean(locker.assignedUserId);
                return (
                  <button
                    key={locker.id}
                    type="button"
                    onClick={() => void handleLockerTap(locker)}
                    className={`flex min-h-[92px] flex-col justify-between rounded-xl border p-3 text-left transition ${
                      occupied
                        ? 'border-oxblood bg-oxblood/20 hover:border-crimson'
                        : 'border-steel bg-obsidian hover:border-access-ok'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="font-display text-xl font-bold text-chalk">
                        {locker.lockerNumber}
                      </span>
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          occupied ? 'bg-crimson' : 'bg-access-ok'
                        }`}
                      />
                    </div>
                    <div>
                      <p className="font-mono text-[10px] text-chrome">
                        {locker.hardwareRelayId}
                      </p>
                      <p className="mt-0.5 text-xs font-semibold text-silver">
                        {occupied ? 'Claimed (Release)' : 'Available'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {lockerStatusMsg && (
              <p className="rounded-lg border border-steel bg-obsidian px-3 py-2 text-xs text-silver">
                {lockerStatusMsg}
              </p>
            )}
          </section>
        ) : null}

        {/* CONSOLE TAB 3: QR SCANNER & ASSET REPORTER */}
        {consoleTab === 'QR_SCANNER' ? (
          <section className="va-card space-y-4 rounded-2xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display flex items-center gap-2 text-2xl font-bold uppercase text-chalk">
                <QrCode className="h-5 w-5 text-crimson" strokeWidth={1.75} />
                Webcam QR Scanner &amp; Asset Reporter
              </h2>
              <div className="inline-flex rounded-xl border border-steel bg-obsidian p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setQrMode('MEMBER_PASS')}
                  className={`rounded-lg px-3 py-1.5 font-semibold transition ${
                    qrMode === 'MEMBER_PASS'
                      ? 'bg-crimson text-chalk'
                      : 'text-chrome hover:text-chalk'
                  }`}
                >
                  Member QR Pass
                </button>
                <button
                  type="button"
                  onClick={() => setQrMode('EQUIPMENT_REPORT')}
                  className={`rounded-lg px-3 py-1.5 font-semibold transition ${
                    qrMode === 'EQUIPMENT_REPORT'
                      ? 'bg-crimson text-chalk'
                      : 'text-chrome hover:text-chalk'
                  }`}
                >
                  Equipment QR Report
                </button>
              </div>
            </div>

            {/* Camera Controls & Viewport */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void toggleWebcamScanner()}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-steel bg-obsidian px-4 text-xs font-bold uppercase tracking-wider text-chalk transition hover:border-crimson"
              >
                {cameraActive ? (
                  <>
                    <CameraOff className="h-4 w-4 text-crimson" strokeWidth={1.75} />
                    Stop Webcam
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4 text-access-ok" strokeWidth={1.75} />
                    Start Webcam Scanner
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setQrMode('EQUIPMENT_REPORT');
                  void processQrToken('VA-EQ-DHK01-TM04');
                }}
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-oxblood bg-oxblood/25 px-3 text-xs font-semibold text-chalk transition hover:bg-oxblood/45"
              >
                <Wrench className="h-3.5 w-3.5" strokeWidth={1.75} />
                Quick Test: VA-EQ-DHK01-TM04
              </button>

              <button
                type="button"
                onClick={() => {
                  setQrMode('EQUIPMENT_REPORT');
                  void processQrToken('VA-EQ-DHK01-SR02');
                }}
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-steel bg-obsidian px-3 text-xs font-semibold text-silver transition hover:border-crimson"
              >
                VA-EQ-DHK01-SR02
              </button>
            </div>

            <div
              id="va-qr-reader"
              className={`overflow-hidden rounded-xl border border-steel bg-obsidian ${
                cameraActive ? 'min-h-[240px] p-2' : 'hidden'
              }`}
            />

            {cameraError && (
              <p className="rounded-lg border border-access-warn/40 bg-access-warn/10 px-3 py-2 text-xs text-access-warn">
                {cameraError}
              </p>
            )}

            {/* Manual QR Input Fallback */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void processQrToken(qrTokenInput);
              }}
              className="flex flex-col gap-2 sm:flex-row"
            >
              <input
                type="text"
                value={qrTokenInput}
                onChange={(e) => setQrTokenInput(e.target.value)}
                placeholder={
                  qrMode === 'MEMBER_PASS'
                    ? 'Paste rotating VA1.<userId>.<bucket>.<sig> token'
                    : 'Enter Equipment QR Token (e.g., VA-EQ-DHK01-TM04)'
                }
                aria-label="Manual QR Token Input"
                className="min-h-11 flex-1 rounded-xl border border-steel bg-obsidian px-3.5 text-sm text-chalk focus:border-crimson focus:outline-none"
              />
              <button
                type="submit"
                className="min-h-11 rounded-xl bg-crimson px-5 text-xs font-bold uppercase tracking-wider text-chalk transition hover:bg-crimson-hover"
              >
                {qrMode === 'MEMBER_PASS' ? 'Verify QR Pass' : 'Lookup Asset'}
              </button>
            </form>

            {/* Equipment Ticket Form */}
            {qrMode === 'EQUIPMENT_REPORT' && (
              <form
                onSubmit={handleTicketSubmit}
                className="space-y-3 rounded-xl border border-steel bg-obsidian p-4"
              >
                {equipmentAsset ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-steel pb-3">
                    <div>
                      <p className="font-display text-lg font-bold uppercase text-chalk">
                        {equipmentAsset.name}
                      </p>
                      <p className="text-xs text-chrome">
                        Zone: {equipmentAsset.zoneName} · Token:{' '}
                        {equipmentAsset.qrCodeToken}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        equipmentAsset.status === 'OPERATIONAL'
                          ? 'bg-access-ok/15 text-access-ok'
                          : 'bg-access-denied/15 text-access-denied'
                      }`}
                    >
                      {equipmentAsset.status}
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-chrome">
                    Lookup or scan an equipment QR code (such as{' '}
                    <code className="text-chalk">VA-EQ-DHK01-TM04</code>) to
                    report a maintenance issue.
                  </p>
                )}

                <textarea
                  value={ticketDescription}
                  onChange={(e) => setTicketDescription(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="Describe issue (e.g., Treadmill belt slipping at high speed)"
                  className="w-full rounded-xl border border-steel bg-iron p-3 text-sm text-chalk placeholder:text-chrome/60 focus:border-crimson focus:outline-none"
                />

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-steel bg-iron px-3 py-2 text-xs text-silver hover:border-crimson">
                    <Upload className="h-3.5 w-3.5" strokeWidth={1.75} />
                    <span>
                      {ticketPhoto ? ticketPhoto.name : 'Attach Photo (JPG/PNG/WebP)'}
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) =>
                        setTicketPhoto(e.target.files?.[0] ?? null)
                      }
                    />
                  </label>

                  <button
                    type="submit"
                    className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-crimson px-4 text-xs font-bold uppercase tracking-wider text-chalk transition hover:bg-crimson-hover"
                  >
                    <Wrench className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Report Broken Equipment
                  </button>
                </div>
              </form>
            )}

            {ticketNotice && (
              <div className="flex items-center gap-2 rounded-xl border border-steel bg-obsidian px-3.5 py-2.5 text-xs text-silver">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-access-ok" strokeWidth={1.75} />
                <span>{ticketNotice}</span>
              </div>
            )}
          </section>
        ) : null}
      </div>
    </main>
  );
}
