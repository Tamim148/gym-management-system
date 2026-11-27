'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import QRCode from 'qrcode';
import { RefreshCw, ShieldCheck, WifiOff } from 'lucide-react';
import { BUSINESS_RULES, type QrPassPayload } from '@vintage/shared';
import { apiGet } from '@/lib/api';
import { cacheQrPass, getCachedQrPass } from '@/lib/offline-store';

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
    <div className="relative overflow-hidden rounded-2xl border border-chrome/40 bg-gradient-to-br from-[#1C1C22] via-[#121216] to-oxblood-deep p-5 text-chalk shadow-[0_20px_50px_rgba(0,0,0,0.65)]">
      {/* Brushed Chrome Metallic Sheen */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.12),transparent_45%)]" />

      <div className="relative z-10 space-y-4">
        {/* Card Header */}
        <div className="flex items-center justify-between gap-3 border-b border-white/15 pb-3">
          <div className="flex items-center gap-3">
            <Image
              src="/images/logo.png"
              alt="Vintage Aesthetics VIP Crest"
              width={42}
              height={42}
              className="rounded-full border border-chrome/50 bg-obsidian p-0.5"
            />
            <div>
              <p className="font-display text-lg font-extrabold uppercase tracking-wider text-chalk">
                Vintage Aesthetics
              </p>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-silver/80">
                {planName}
              </p>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase ${
              isOfflineCached
                ? 'border-amber-400/50 bg-amber-500/20 text-amber-300'
                : 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300'
            }`}
          >
            {isOfflineCached ? (
              <>
                <WifiOff className="h-3.5 w-3.5" />
                Offline Cached
              </>
            ) : (
              <>
                <ShieldCheck className="h-3.5 w-3.5" />
                Live Token
              </>
            )}
          </span>
        </div>

        {/* QR Code Surface */}
        <div className="flex flex-col items-center justify-center gap-3 py-2">
          <div className="rounded-2xl border-2 border-chrome/50 bg-chalk p-3 shadow-inner">
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
            <p className="max-w-full truncate rounded-md bg-black/40 px-2.5 py-1 font-mono text-[11px] text-silver/90">
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
            <div className="rounded-xl border border-white/15 bg-black/40 px-3 py-1.5 text-center">
              <p className="text-[10px] uppercase tracking-wider text-chrome">Rotates In</p>
              <p className="font-display text-lg font-extrabold text-chalk">
                {secondsLeft}s
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadQrPass()}
              aria-label="Refresh QR Pass"
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-chrome/40 bg-obsidian/70 text-chalk transition-colors hover:bg-crimson"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
