import { BRANCH_CODES, BUSINESS_RULES } from '@vintage/shared';
import { Building2, ShieldCheck, Smartphone, Terminal } from 'lucide-react';
import Image from 'next/image';

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
    title: 'Front-Desk Live Access',
    description: 'Real-time turnstile stream, manual override audit modal, and split due collection.',
    icon: ShieldCheck,
    status: 'Phase 1 Target',
  },
  {
    title: 'Super Admin Command',
    description: 'Multi-branch KPIs, Festival Promo builder, Churn Radar, and Feature Flags.',
    icon: Building2,
    status: 'Phase 1 Target',
  },
  {
    title: 'Member & Trainer PWA',
    description: 'Rotating 60s Oxblood QR Pass, Off-Peak deals, Waitlist booking, and Coach rosters.',
    icon: Smartphone,
    status: 'Phase 1 Target',
  },
  {
    title: 'Hardware Simulator',
    description: 'Virtual RFID taps, Offline Outage sync drill, Smart Lockers, and Webcam QR scanner.',
    icon: Terminal,
    status: 'Phase 1 Target',
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-obsidian px-6 py-12 text-chalk">
      <div className="mx-auto max-w-6xl space-y-10">
        <section className="va-card va-hero-gradient rounded-2xl p-8 md:p-10">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="flex items-center gap-5">
              <Image
                src="/images/logo.png"
                alt="Vintage Aesthetics Gym Emblem"
                width={76}
                height={76}
                className="rounded-full border border-steel bg-obsidian p-1"
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
                  Multi-Branch Management Ecosystem • {BUSINESS_RULES.GYM_TIMEZONE} • Phase 0 Foundation Ready
                </p>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-access-ok/40 bg-access-ok/10 px-4 py-2 text-xs font-semibold text-access-ok">
              <span className="h-2 w-2 rounded-full bg-access-ok" />
              Neon PostgreSQL + pgvector + RLS Baseline
            </div>
          </div>
        </section>

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
                  <span className="text-xs text-chrome">
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

        <section className="space-y-4">
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-chalk">
            Ecosystem Portals (Step 3 Rollout)
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {portals.map((portal) => {
              const Icon = portal.icon;
              return (
                <div key={portal.title} className="va-card rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-oxblood/40 text-crimson">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="font-display text-xl font-bold uppercase text-chalk">
                        {portal.title}
                      </h3>
                    </div>
                    <span className="rounded-full border border-steel px-2.5 py-0.5 text-xs text-chrome">
                      {portal.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-chrome">{portal.description}</p>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
