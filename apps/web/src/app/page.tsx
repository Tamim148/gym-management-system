import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  Building2,
  Dumbbell,
  Inbox,
  LogIn,
  ShieldCheck,
  Smartphone,
  Terminal,
  UserPlus,
} from 'lucide-react';
import { BRANCH_CODES, BUSINESS_RULES } from '@vintage/shared';

const branches = [
  {
    code: BRANCH_CODES.GULSHAN,
    name: 'Gulshan-1 Flagship',
    address: 'Road 12, Gulshan-1, Dhaka 1212',
    capacity: 80,
  },
  {
    code: BRANCH_CODES.DHANMONDI,
    name: 'Dhanmondi Iron Club',
    address: 'Satmasjid Road, Dhanmondi 27, Dhaka 1209',
    capacity: 70,
  },
  {
    code: BRANCH_CODES.UTTARA,
    name: 'Uttara Sector-7 Studio',
    address: 'Road 18, Sector 7, Uttara, Dhaka 1230',
    capacity: 60,
  },
];

const portals = [
  {
    title: 'Member & Staff Login',
    href: '/login',
    description:
      'Sign in with HTTP-only JWT cookies or use 1-click Demo Role Quick-Fill buttons (Vintage@2026).',
    icon: LogIn,
    badge: 'Auth',
  },
  {
    title: 'Member Self-Onboarding',
    href: '/onboard',
    description:
      'Multi-step registration with OTP preview, PAR-Q health waiver canvas signature, and Mock Checkout.',
    icon: UserPlus,
    badge: 'Join Now',
  },
  {
    title: 'Front-Desk Live Access',
    href: '/desk',
    description:
      'Real-time Socket.IO turnstile stream, pulsing denial alerts, manual override audit modal, and due settlement.',
    icon: ShieldCheck,
    badge: 'Reception',
  },
  {
    title: 'Super Admin Command',
    href: '/admin',
    description:
      '3-Branch KPIs, Festival Campaign Builder, AI Churn Radar, Maintenance Kanban, and Feature Flags.',
    icon: Building2,
    badge: 'Executive',
  },
  {
    title: 'Member Mobile PWA',
    href: '/member',
    description:
      'Dark Mode PWA with Metallic 60s QR Pass, Live Crowd Meter, Off-Peak Deals, Waitlist, and Plan Freeze.',
    icon: Smartphone,
    badge: 'Member',
  },
  {
    title: 'Trainer Portal',
    href: '/trainer',
    description:
      'PT & Group Schedule CRUD, Booked-Slot Cancel workflow, Live Roster, Equipment alerts, and 40% Commission.',
    icon: Dumbbell,
    badge: 'Coach',
  },
  {
    title: 'Hardware Simulator',
    href: '/simulator',
    description:
      'Virtual RFID turnstile taps, Offline Outage queue drill, Smart Lockers, and Webcam QR scanner.',
    icon: Terminal,
    badge: '$0 IoT Lab',
  },
  {
    title: 'Free Dev Inbox',
    href: '/dev-inbox',
    description:
      'Zero-cost notification preview inbox for OTP codes, payment receipts, Telegram alerts, and churn nudges.',
    icon: Inbox,
    badge: 'Notifications',
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-obsidian px-4 py-8 text-chalk md:px-6 md:py-12">
      <div className="mx-auto max-w-6xl space-y-10">
        {/* Hero Banner */}
        <section className="va-card va-hero-gradient rounded-2xl p-6 md:p-10">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="flex items-center gap-5">
              <Image
                src="/images/logo.png"
                alt="Vintage Aesthetics Gym Emblem"
                width={80}
                height={80}
                className="rounded-full border border-chrome/40 bg-obsidian p-1"
                priority
              />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-chrome">
                  Modern Golden Era Iron • $0 Free Stack
                </p>
                <h1 className="font-display text-4xl font-extrabold uppercase tracking-tight text-chalk md:text-5xl">
                  Vintage Aesthetics Gym
                </h1>
                <p className="mt-1 text-sm text-silver">
                  Multi-Branch Management Ecosystem • {BUSINESS_RULES.GYM_TIMEZONE} • Live Portals Ready
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-crimson px-5 py-3 text-sm font-bold uppercase tracking-wider text-chalk shadow-lg shadow-crimson/25 transition-colors hover:bg-crimson-hover"
              >
                <LogIn className="h-4 w-4" />
                Portal Login
              </Link>
              <Link
                href="/onboard"
                className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border border-chrome/40 bg-obsidian/70 px-5 py-3 text-sm font-bold uppercase tracking-wider text-chalk transition-colors hover:border-crimson hover:bg-oxblood/40"
              >
                <UserPlus className="h-4 w-4" />
                Join Member
              </Link>
            </div>
          </div>
        </section>

        {/* Dhaka Branch Network */}
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-chalk">
            Dhaka Branch Network
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {branches.map((branch) => (
              <div key={branch.code} className="va-card rounded-xl p-5">
                <div className="flex items-center justify-between">
                  <span className="rounded bg-oxblood px-2.5 py-1 text-xs font-bold tracking-wider text-chalk">
                    {branch.code}
                  </span>
                  <span className="text-xs font-semibold text-chrome">
                    Max Cap: {branch.capacity}
                  </span>
                </div>
                <h3 className="font-display mt-3 text-xl font-bold uppercase text-chalk">
                  {branch.name}
                </h3>
                <p className="mt-1 text-sm text-chrome">{branch.address}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Ecosystem Portals */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-chalk">
              Ecosystem Portals & Simulators
            </h2>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              All Routes Active
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {portals.map((portal) => {
              const Icon = portal.icon;
              return (
                <Link
                  key={portal.href}
                  href={portal.href}
                  className="va-card group flex min-h-[168px] flex-col justify-between rounded-xl p-5 transition-all hover:border-crimson/70 hover:-translate-y-0.5"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-oxblood/50 text-crimson transition-colors group-hover:bg-crimson group-hover:text-chalk">
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="rounded-full border border-steel bg-obsidian px-2.5 py-0.5 text-[11px] font-semibold text-chrome">
                        {portal.badge}
                      </span>
                    </div>
                    <h3 className="font-display mt-4 text-xl font-bold uppercase text-chalk">
                      {portal.title}
                    </h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-chrome">
                      {portal.description}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-crimson group-hover:text-chalk">
                    <span>Open Portal</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
