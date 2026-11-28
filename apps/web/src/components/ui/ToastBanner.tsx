'use client';

import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export interface ToastState {
  type: 'success' | 'error' | 'info';
  message: string;
}

export function ToastBanner({
  toast,
  onDismiss,
}: {
  toast: ToastState | null;
  onDismiss: () => void;
}) {
  if (!toast) return null;

  const styles =
    toast.type === 'success'
      ? 'border-emerald-500/50 bg-[#0D1E17] text-emerald-200'
      : toast.type === 'error'
        ? 'border-[#FF2A3B]/60 bg-[#220B0E] text-red-100'
        : 'border-amber-500/50 bg-[#21180A] text-amber-100';

  const Icon =
    toast.type === 'success'
      ? CheckCircle2
      : toast.type === 'error'
        ? AlertCircle
        : Info;

  return (
    <div
      role="status"
      className={`fixed right-4 bottom-24 z-50 flex max-w-md items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-2xl md:bottom-6 ${styles}`}
    >
      <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      <p className="flex-1 font-medium">{toast.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10"
      >
        <X className="h-4 w-4" strokeWidth={1.75} />
      </button>
    </div>
  );
}
