'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { RefreshCw, ShieldCheck, WifiOff } from 'lucide-react';
import { BUSINESS_RULES, type QrPassPayload } from '@vintage/shared';
import { apiGet } from '@/lib/api';
import { cacheQrPass, getCachedQrPass } from '@/lib/offline-store';
import { BrandCrest } from '@/components/ui/BrandCrest';

interface MetallicQrPassCardProps {
  userId: string;
  memberName: string;
  branchName?: string;
  planName?: string;
  compact?: boolean;
}

export function MetallicQrPassCard({
  userId,
  memberName,
  branchName = 'Dhaka Ecosystem',
  planName = 'Active Member',
  compact = false,
}: MetallicQrPassCardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [payload, setPayload] = useState<QrPassPayload | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(BUSINESS_RULES.QR_BUCKET_SECONDS);
  const [isOfflineCached, setIsOfflineCached] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadQrPass = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fresh = await apiGet<QrPassPayload>('/api/access/qr-pass');
      setPayload(fresh);
      setIsOfflineCached(false);
      await cacheQrPass({
        ...fresh,
        cachedAt: new Date().toISOString(),
        memberName,
        branchName,
        planName,
      });
    } catch {
      const cached = await getCachedQrPass(userId);
      if (cached) {
        setPayload(cached);
        setIsOfflineCached(true);
      } else {
        setError('Unable to fetch rotating QR pass. Connect to refresh.');
      }
    } finally {
      setLoading(false);
    }
  }, [userId, memberName, branchName, planName]);

  useEffect(() => {
    void loadQrPass();
  }, [loadQrPass]);

  // Render QR code onto canvas whenever token changes
  useEffect(() => {
    if (!payload?.token || !canvasRef.current) return;
    QRCode.toCanvas(
      canvasRef.current,
      payload.token,
      {
        width: compact ? 156 : 192,
        margin: 1,
        color: {
          dark: '#0A0A0C',
          light: '#FAFAFA',
        },
      },
      () => undefined,
    );
  }, [payload?.token, compact]);

  // Countdown timer + automatic 60s rotation
  useEffect(() => {
    if (!payload?.expiresAt) return;

    const updateTimer = () => {
      const diffSec = Math.max(
        0,
        Math.ceil((new Date(payload.expiresAt).getTime() - Date.now()) / 1000),
      );
      setSecondsLeft(diffSec);
      if (diffSec === 0 && typeof navigator !== 'undefined' && navigator.onLine) {
        void loadQrPass();
      }
    };

    updateTimer();
    const timerId = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(timerId);
  }, [payload?.expiresAt, loadQrPass]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-silver/35 bg-linear-to-br from-[#1B1B20] via-iron to-oxblood-deep text-chalk shadow-2xl">
      {/* 1px Crimson LED Strip */}
      <div className="va-led-rule w-full" />

      <div className="space-y-4 p-5">
        {/* Card Header */}
        <div className="flex items-center justify-between gap-3 border-b border-white/15 pb-3">
          <div className="flex items-center gap-3">
            <BrandCrest size={42} alt="Vintage Aesthetics VIP Crest" />
            <div>
              <p className="font-display text-lg font-extrabold uppercase tracking-wider text-chalk">
                Vintage Aesthetics
              </p>
              <p className="text-[11px] font-semibold text-silver/80">
                {planName}
              </p>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
              isOfflineCached
                ? 'border-amber-400/50 bg-amber-500/20 text-amber-300'
                : 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300'
            }`}
          >
            {isOfflineCached ? (
              <>
                <WifiOff className="h-3.5 w-3.5" strokeWidth={1.75} />
                Offline Cached
              </>
            ) : (
              <>
                <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.75} />
                Live Token
              </>
            )}
          </span>
        </div>

        {/* QR Code Surface */}
        <div className="flex flex-col items-center justify-center gap-3 py-2">
          <div className="rounded-2xl border-2 border-silver/50 bg-chalk p-3 shadow-inner">
            {loading && !payload ? (
              <div className="flex h-[180px] w-[180px] items-center justify-center bg-zinc-200 text-xs font-bold text-zinc-700">
                Generating QR...
              </div>
            ) : error ? (
              <div className="flex h-[180px] w-[180px] items-center justify-center p-4 text-center text-xs font-semibold text-red-700">
                {error}
              </div>
            ) : (
              <canvas
                ref={canvasRef}
                aria-label="Rotating Member Entry QR Code"
                className="block rounded-lg"
              />
            )}
          </div>

          {payload?.token ? (
            <p className="max-w-full truncate rounded-md border border-white/10 bg-obsidian/70 px-2.5 py-1 font-mono text-[11px] text-silver/90">
              {payload.token}
            </p>
          ) : null}
        </div>

        {/* Footer: Member Info + Countdown + Manual Refresh */}
        <div className="flex items-center justify-between gap-3 border-t border-white/15 pt-3">
          <div className="min-w-0">
            <p className="truncate font-display text-xl font-bold uppercase text-chalk">
              {memberName}
            </p>
            <p className="truncate text-xs text-silver/80">{branchName}</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-xl border border-white/15 bg-obsidian/70 px-3 py-1.5 text-center tabular-nums">
              <p className="text-[10px] font-semibold text-chrome">Rotates In</p>
              <p className="font-display text-lg font-extrabold text-chalk">
                {secondsLeft}s
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadQrPass()}
              aria-label="Refresh QR Pass"
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-silver/40 bg-obsidian text-chalk transition-colors hover:border-crimson hover:bg-crimson"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
