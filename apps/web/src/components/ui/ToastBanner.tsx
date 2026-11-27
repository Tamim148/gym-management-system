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
      ? 'border-emerald-500/40 bg-emerald-950/90 text-emerald-200'
      : toast.type === 'error'
        ? 'border-[#FF2A3B]/60 bg-red-950/90 text-red-100'
        : 'border-amber-500/40 bg-amber-950/90 text-amber-100';

  const Icon =
    toast.type === 'success'
      ? CheckCircle2
      : toast.type === 'error'
        ? AlertCircle
        : Info;

  return (
    <div
      role="status"
      className={`fixed right-4 bottom-20 z-50 flex max-w-md items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-md md:bottom-6 ${styles}`}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      <p className="flex-1 font-medium">{toast.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
