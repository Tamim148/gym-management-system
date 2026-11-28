'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  maxWidthClass?: string;
  lightMode?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidthClass = 'max-w-lg',
  lightMode = false,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidthClass} max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl ${
          lightMode
            ? 'border-zinc-200 bg-white text-zinc-900'
            : 'border-steel bg-iron text-chalk'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {!lightMode ? <div className="va-led-rule w-full" /> : null}
        <div
          className={`flex items-start justify-between gap-4 border-b px-5 py-4 ${
            lightMode ? 'border-zinc-200' : 'border-steel'
          }`}
        >
          <div>
            <h2 className="font-display text-2xl font-bold uppercase tracking-wide">
              {title}
            </h2>
            {subtitle ? (
              <p className={`mt-0.5 text-xs ${lightMode ? 'text-zinc-500' : 'text-chrome'}`}>
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors ${
              lightMode
                ? 'border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                : 'border-steel text-chrome hover:bg-steel/60 hover:text-chalk'
            }`}
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
