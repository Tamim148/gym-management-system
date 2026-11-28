'use client';

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Lock,
  ShieldAlert,
  Snowflake,
  Wrench,
} from 'lucide-react';
import { EntryStatus, EquipmentStatus, PaymentStatus } from '@vintage/shared';

interface EntryStatusBadgeProps {
  status: EntryStatus;
}

export function EntryStatusBadge({ status }: EntryStatusBadgeProps) {
  switch (status) {
    case EntryStatus.ALLOWED:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-xs font-bold tracking-wide text-emerald-500">
          <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          Granted
        </span>
      );
    case EntryStatus.MANUAL_OVERRIDE:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 text-xs font-bold tracking-wide text-amber-500">
          <ShieldAlert className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          Manual Override
        </span>
      );
    case EntryStatus.DENIED_FROZEN:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FF2A3B]/60 bg-[#FF2A3B]/15 px-2.5 py-1 text-xs font-bold tracking-wide text-[#FF2A3B]">
          <Lock className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          Denied: Frozen
        </span>
      );
    case EntryStatus.DENIED_EXPIRED:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FF2A3B]/60 bg-[#FF2A3B]/15 px-2.5 py-1 text-xs font-bold tracking-wide text-[#FF2A3B]">
          <Lock className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          Denied: Expired
        </span>
      );
    case EntryStatus.DENIED_WRONG_BRANCH:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FF2A3B]/60 bg-[#FF2A3B]/15 px-2.5 py-1 text-xs font-bold tracking-wide text-[#FF2A3B]">
          <Lock className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          Denied: Wrong Branch
        </span>
      );
    case EntryStatus.DENIED_UNPAID:
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FF2A3B]/60 bg-[#FF2A3B]/15 px-2.5 py-1 text-xs font-bold tracking-wide text-[#FF2A3B]">
          <Lock className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          Denied: Unpaid Dues
        </span>
      );
  }
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  switch (status) {
    case PaymentStatus.PAID:
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-500">
          <CheckCircle2 className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
          Paid
        </span>
      );
    case PaymentStatus.PARTIAL:
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-500">
          <Clock className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
          Partial
        </span>
      );
    case PaymentStatus.FROZEN:
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-zinc-400/40 bg-zinc-500/15 px-2.5 py-0.5 text-xs font-semibold text-zinc-300">
          <Snowflake className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
          Frozen
        </span>
      );
    case PaymentStatus.OVERDUE:
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-[#FF2A3B]/50 bg-[#FF2A3B]/15 px-2.5 py-0.5 text-xs font-semibold text-[#FF2A3B]">
          <AlertTriangle className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
          {status}
        </span>
      );
  }
}

export function EquipmentStatusBadge({ status }: { status: EquipmentStatus }) {
  switch (status) {
    case EquipmentStatus.OPERATIONAL:
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-500">
          <CheckCircle2 className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
          Operational
        </span>
      );
    case EquipmentStatus.UNDER_MAINTENANCE:
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-500">
          <Wrench className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
          Maintenance
        </span>
      );
    case EquipmentStatus.OUT_OF_ORDER:
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-[#FF2A3B]/50 bg-[#FF2A3B]/15 px-2.5 py-0.5 text-xs font-semibold text-[#FF2A3B]">
          <AlertTriangle className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
          Out of Order
        </span>
      );
  }
}
