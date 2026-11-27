'use client';

import { useState, type FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  LogIn,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import type { AuthSessionResponse, LoginDto } from '@vintage/shared';
import { ApiError, apiPost } from '@/lib/api';
import { DEMO_ACCOUNTS, getRoleLandingRoute } from '@/lib/dal';

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isSharedTablet, setIsSharedTablet] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filledLabel, setFilledLabel] = useState<string | null>(null);

  const performLogin = async (payload: LoginDto) => {
    setSubmitting(true);
    setError(null);
    try {
      const response = await apiPost<AuthSessionResponse>('/api/auth/login', payload);
      router.push(getRoleLandingRoute(response.user.role));
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Unable to sign in. Verify API server is running.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await performLogin({
      identifier: identifier.trim(),
      password,
      isSharedTablet,
    });
  };

  const handleQuickFill = (presetLabel: string, presetId: string, presetPass: string) => {
    setIdentifier(presetId);
    setPassword(presetPass);
    setFilledLabel(presetLabel);
    setError(null);
  };

  return (
    <main className="min-h-screen bg-obsidian px-4 py-8 text-chalk md:px-6 md:py-12">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border border-steel bg-iron px-4 py-2 text-xs font-bold uppercase tracking-wider text-silver hover:border-crimson hover:text-chalk"
          >
            <ArrowLeft className="h-4 w-4" />
            Ecosystem Hub
          </Link>
          <Link
            href="/onboard"
            className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border border-oxblood bg-oxblood/30 px-4 py-2 text-xs font-bold uppercase tracking-wider text-chalk hover:bg-oxblood/60"
          >
            <UserPlus className="h-4 w-4" />
            New Member Onboard
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          {/* Login Form Card */}
          <section className="va-card va-hero-gradient rounded-2xl p-6 md:p-8 lg:col-span-6">
            <div className="flex items-center gap-4 border-b border-white/10 pb-5">
              <Image
                src="/images/logo.png"
                alt="Vintage Aesthetics Gym Emblem"
                width={60}
                height={60}
                className="rounded-full border border-chrome/40 bg-obsidian p-0.5"
                priority
              />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-chrome">
                  HTTP-Only Cookie Auth
                </p>
                <h1 className="font-display text-3xl font-extrabold uppercase tracking-wide text-chalk">
                  Portal Sign In
                </h1>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {error ? (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-xl border border-[#FF2A3B]/60 bg-[#FF2A3B]/15 p-3.5 text-xs font-semibold text-[#FF2A3B]"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}

              {filledLabel ? (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2.5 text-xs font-semibold text-emerald-300">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Filled credentials for {filledLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      void performLogin({
                        identifier: identifier.trim(),
                        password,
                        isSharedTablet,
                      })
                    }
                    className="rounded-lg bg-emerald-500 px-2.5 py-1 text-[11px] font-bold uppercase text-zinc-950 hover:bg-emerald-400"
                  >
                    Enter Now
                  </button>
                </div>
              ) : null}

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-silver">
                  Email or Phone (+880...)
                </span>
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="desk.gulshan@vintageaesthetics.gym"
                  className="min-h-[48px] w-full rounded-xl border border-steel bg-obsidian/90 px-4 text-sm text-chalk outline-none focus:border-crimson"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-silver">
                  Password
                </span>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 10 characters for new accounts"
                    className="min-h-[48px] w-full rounded-xl border border-steel bg-obsidian/90 pr-12 pl-4 text-sm text-chalk outline-none focus:border-crimson"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute top-0 right-0 flex h-12 w-12 items-center justify-center text-chrome hover:text-chalk"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              <label className="flex min-h-[48px] cursor-pointer items-center justify-between gap-3 rounded-xl border border-steel bg-obsidian/60 px-4 py-2">
                <div>
                  <p className="text-xs font-bold text-chalk">Shared Front-Desk Tablet</p>
                  <p className="text-[11px] text-chrome">
                    Limits refresh session to 24h instead of 7 days
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={isSharedTablet}
                  onChange={(e) => setIsSharedTablet(e.target.checked)}
                  className="h-5 w-5 accent-crimson"
                />
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-crimson px-5 py-3 text-sm font-bold uppercase tracking-wider text-chalk shadow-lg shadow-crimson/25 transition-colors hover:bg-crimson-hover disabled:opacity-50"
              >
                <LogIn className="h-5 w-5" />
                {submitting ? 'Authenticating...' : 'Sign In'}
              </button>
            </form>

            <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-chrome">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                Zero LocalStorage Tokens
              </span>
              <Link href="/onboard" className="font-bold text-crimson hover:underline">
                Create Member Account →
              </Link>
            </div>
          </section>

          {/* 1-Click Demo Role Quick-Fill Panel */}
          <section className="va-card rounded-2xl p-6 md:p-8 lg:col-span-6">
            <div className="flex items-center justify-between gap-3 border-b border-steel pb-4">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-amber-400">
                  <Sparkles className="h-3.5 w-3.5" />
                  Seeded Test Personas
                </p>
                <h2 className="font-display text-2xl font-bold uppercase text-chalk">
                  1-Click Demo Quick-Fill
                </h2>
              </div>
              <span className="rounded-lg border border-steel bg-obsidian px-2.5 py-1 font-mono text-xs text-silver">
                Vintage@2026
              </span>
            </div>

            <p className="mt-3 text-xs text-chrome">
              Tap any role below to fill its seeded credentials instantly, then click Sign In or
              Enter Now.
            </p>

            <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {DEMO_ACCOUNTS.map((preset) => {
                const isSelected = identifier === preset.identifier;
                return (
                  <button
                    key={preset.identifier}
                    type="button"
                    onClick={() =>
                      handleQuickFill(preset.label, preset.identifier, preset.password)
                    }
                    className={`min-h-[68px] rounded-xl border p-3 text-left transition-all ${
                      isSelected
                        ? 'border-crimson bg-oxblood/40 text-chalk'
                        : 'border-steel bg-obsidian/80 text-silver hover:border-chrome/60 hover:text-chalk'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-chalk">{preset.label}</span>
                      <span className="rounded bg-iron px-1.5 py-0.5 text-[10px] font-semibold uppercase text-chrome">
                        {preset.role.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="mt-1 truncate font-mono text-[11px] text-chrome">
                      {preset.identifier}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-amber-400/90">{preset.note}</p>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
