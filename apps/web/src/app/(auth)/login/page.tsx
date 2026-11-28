'use client';

import { useState, type FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  KeyRound,
  LogIn,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import type { AuthSessionResponse, LoginDto } from '@vintage/shared';
import { ApiError, apiPost } from '@/lib/api';
import { DEMO_ACCOUNTS, getRoleLandingRoute } from '@/lib/dal';
import { BrandCrest } from '@/components/ui/BrandCrest';

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isSharedTablet, setIsSharedTablet] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filledLabel, setFilledLabel] = useState<string | null>(null);
  const [demoOpen, setDemoOpen] = useState(false);

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
    <main className="min-h-screen bg-obsidian px-4 pt-6 pb-24 text-chalk md:px-6 md:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-steel bg-iron px-4 text-xs font-bold uppercase tracking-wider text-silver hover:border-crimson hover:text-chalk"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
            Storefront
          </Link>
          <Link
            href="/onboard"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-oxblood bg-oxblood/30 px-4 text-xs font-bold uppercase tracking-wider text-chalk hover:bg-oxblood/60"
          >
            <UserPlus className="h-4 w-4" strokeWidth={1.75} />
            Join Member
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          {/* Login Form Card */}
          <section className="overflow-hidden rounded-2xl border border-steel bg-iron lg:col-span-6">
            <div className="va-led-rule w-full" />
            <div className="p-6 md:p-8">
              <div className="flex items-center gap-4 border-b border-steel pb-5">
                <BrandCrest size={56} priority />
                <div>
                  <p className="text-xs font-medium text-chrome">
                    Secure Portal Access
                  </p>
                  <h1 className="font-display text-3xl font-extrabold uppercase tracking-wide text-chalk">
                    Member &amp; Staff Sign In
                  </h1>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                {error ? (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-xl border border-[#FF2A3B]/60 bg-[#FF2A3B]/15 p-3.5 text-xs font-semibold text-[#FF2A3B]"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
                    <span>{error}</span>
                  </div>
                ) : null}

                {filledLabel ? (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2.5 text-xs font-semibold text-emerald-300">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={1.75} />
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
                      className="shrink-0 rounded-lg bg-emerald-500 px-2.5 py-1 text-[11px] font-bold uppercase text-zinc-950 hover:bg-emerald-400"
                    >
                      Enter Now
                    </button>
                  </div>
                ) : null}

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-silver">
                    Email or Phone (+880...)
                  </span>
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="desk.gulshan@vintageaesthetics.gym"
                    className="min-h-12 w-full rounded-xl border border-steel bg-obsidian px-4 text-sm text-chalk outline-none focus:border-crimson"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-silver">
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
                      placeholder="Enter password"
                      className="min-h-12 w-full rounded-xl border border-steel bg-obsidian pr-12 pl-4 text-sm text-chalk outline-none focus:border-crimson"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute top-0 right-0 flex h-12 w-12 items-center justify-center text-chrome hover:text-chalk"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" strokeWidth={1.75} />
                      ) : (
                        <Eye className="h-4 w-4" strokeWidth={1.75} />
                      )}
                    </button>
                  </div>
                </label>

                <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border border-steel bg-obsidian px-4 py-2.5">
                  <div>
                    <p className="text-xs font-bold text-chalk">Shared Front-Desk Tablet</p>
                    <p className="text-[11px] text-chrome">
                      Limits refresh session to 24 hours instead of 7 days
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={isSharedTablet}
                    onChange={(e) => setIsSharedTablet(e.target.checked)}
                    className="h-5 w-5 shrink-0 accent-crimson"
                  />
                </label>

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-crimson px-5 py-3 text-sm font-bold uppercase tracking-wider text-chalk transition-colors hover:bg-crimson-hover disabled:opacity-50"
                >
                  <LogIn className="h-5 w-5" strokeWidth={1.75} />
                  {submitting ? 'Authenticating...' : 'Sign In'}
                </button>
              </form>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-steel pt-4 text-xs text-chrome">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" strokeWidth={1.75} />
                  HTTP-Only Session Cookies
                </span>
                <Link href="/onboard" className="font-bold text-crimson hover:underline">
                  Create Member Account
                </Link>
              </div>
            </div>
          </section>

          {/* Editorial Photography + Compact Collapsible QA Demo Switcher */}
          <section className="flex flex-col overflow-hidden rounded-2xl border border-steel bg-iron lg:col-span-6">
            <div className="relative h-64 w-full overflow-hidden lg:h-72">
              <Image
                src="/images/red-led-rack.jpg"
                alt="Vintage Aesthetics crimson LED mirror and squat rack floor"
                fill
                className="object-cover object-top"
              />
              <div className="absolute inset-0 bg-linear-to-t from-[#0A0A0C] via-[#0A0A0C]/65 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6">
                <h2 className="font-display text-3xl font-extrabold uppercase text-chalk">
                  Gulshan-1 · Dhanmondi · Uttara
                </h2>
                <p className="mt-1 text-xs text-silver">
                  One account system across turnstiles, coaching rosters, front-desk reception, and executive analytics.
                </p>
              </div>
            </div>

            <div className="flex-1 p-6">
              <button
                type="button"
                onClick={() => setDemoOpen((prev) => !prev)}
                aria-expanded={demoOpen}
                className="flex min-h-12 w-full items-center justify-between rounded-xl border border-steel bg-obsidian px-4 py-3 text-left transition-colors hover:border-crimson"
              >
                <span className="flex items-center gap-2.5">
                  <KeyRound className="h-4 w-4 text-amber-500" strokeWidth={1.75} />
                  <span>
                    <span className="block text-xs font-bold uppercase tracking-wider text-chalk">
                      QA Demo Role Switcher
                    </span>
                    <span className="block text-[11px] text-chrome">
                      1-click fill for seeded member, trainer, desk, and admin personas
                    </span>
                  </span>
                </span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-chrome transition-transform ${
                    demoOpen ? 'rotate-180 text-crimson' : ''
                  }`}
                  strokeWidth={1.75}
                />
              </button>

              {demoOpen ? (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between text-xs text-chrome">
                    <span>Tap a persona to fill credentials</span>
                    <span className="rounded border border-steel bg-obsidian px-2 py-0.5 font-mono text-[11px] text-silver">
                      Vintage@2026
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {DEMO_ACCOUNTS.map((preset) => {
                      const isSelected = identifier === preset.identifier;
                      return (
                        <button
                          key={preset.identifier}
                          type="button"
                          onClick={() =>
                            handleQuickFill(preset.label, preset.identifier, preset.password)
                          }
                          className={`rounded-xl border p-3 text-left transition-colors ${
                            isSelected
                              ? 'border-crimson bg-oxblood/40 text-chalk'
                              : 'border-steel bg-obsidian text-silver hover:border-chrome/60 hover:text-chalk'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-chalk">{preset.label}</span>
                            <span className="rounded bg-iron px-1.5 py-0.5 text-[10px] font-semibold text-chrome">
                              {preset.role.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-[11px] text-amber-400">
                            {preset.note}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  {DEMO_ACCOUNTS.slice(0, 4).map((preset) => (
                    <button
                      key={preset.identifier}
                      type="button"
                      onClick={() =>
                        handleQuickFill(preset.label, preset.identifier, preset.password)
                      }
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        identifier === preset.identifier
                          ? 'border-crimson bg-oxblood/40 text-chalk'
                          : 'border-steel bg-obsidian text-silver hover:border-crimson'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
