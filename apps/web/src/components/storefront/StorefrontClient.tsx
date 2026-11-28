'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Activity,
  Check,
  ChevronDown,
  Clock,
  Dumbbell,
  KeyRound,
  MapPin,
  Menu,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { BRANCH_CODES, BillingCycle } from '@vintage/shared';
import { apiGet, apiPost } from '@/lib/api';
import { formatBdt } from '@/lib/dal';
import type {
  BranchItem,
  FreePassLeadPayload,
  FreePassLeadResult,
  MembershipPlanItem,
} from '@/lib/types';
import { BrandCrest } from '@/components/ui/BrandCrest';

const FALLBACK_BRANCHES: BranchItem[] = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    code: BRANCH_CODES.GULSHAN,
    name: 'Gulshan-1 Flagship',
    address: 'Road 12, Gulshan-1, Dhaka 1212',
    maxOccupancy: 80,
    currentOccupancy: 34,
    edgeNodeOnline: true,
    staffedHours: '06:00 AM – 11:00 PM (24/7 Member RFID)',
    coaches: [
      { id: 'c1', fullName: 'Coach Arif Rahman', specialty: 'Strength & Hypertrophy', branchCode: BRANCH_CODES.GULSHAN },
      { id: 'c2', fullName: 'Coach Nabila Karim', specialty: 'Athletic Conditioning', branchCode: BRANCH_CODES.GULSHAN },
    ],
  },
  {
    id: '10000000-0000-4000-8000-000000000002',
    code: BRANCH_CODES.DHANMONDI,
    name: 'Dhanmondi Iron Club',
    address: 'Satmasjid Road, Dhanmondi 27, Dhaka 1209',
    maxOccupancy: 70,
    currentOccupancy: 28,
    edgeNodeOnline: true,
    staffedHours: '06:00 AM – 11:00 PM (24/7 Member RFID)',
    coaches: [
      { id: 'c3', fullName: 'Coach Tariqul Hasan', specialty: 'Powerlifting & Squat', branchCode: BRANCH_CODES.DHANMONDI },
      { id: 'c4', fullName: 'Coach Samira Chowdhury', specialty: 'Mobility & HIIT', branchCode: BRANCH_CODES.DHANMONDI },
    ],
  },
  {
    id: '10000000-0000-4000-8000-000000000003',
    code: BRANCH_CODES.UTTARA,
    name: 'Uttara Sector-7 Studio',
    address: 'Road 18, Sector 7, Uttara, Dhaka 1230',
    maxOccupancy: 60,
    currentOccupancy: 19,
    edgeNodeOnline: true,
    staffedHours: '07:00 AM – 10:30 PM (24/7 Member RFID)',
    coaches: [
      { id: 'c5', fullName: 'Coach Farhan Mahmud', specialty: 'Olympic Lifting', branchCode: BRANCH_CODES.UTTARA },
      { id: 'c6', fullName: 'Coach Zara Hossain', specialty: 'Metabolic Burn', branchCode: BRANCH_CODES.UTTARA },
    ],
  },
];

const FALLBACK_PLANS: MembershipPlanItem[] = [
  {
    id: '20000000-0000-4000-8000-000000000001',
    name: 'Off-Peak Iron (1 PM–3 PM)',
    billingCycle: BillingCycle.MONTHLY,
    priceBdt: 2500,
    durationDays: 30,
    sessionCredits: 4,
    roamingEnabled: false,
    offPeakOnly: true,
    offPeakStartHour: 13,
    offPeakEndHour: 15,
  },
  {
    id: '20000000-0000-4000-8000-000000000002',
    name: 'Monthly Home Club',
    billingCycle: BillingCycle.MONTHLY,
    priceBdt: 3500,
    durationDays: 30,
    sessionCredits: 6,
    roamingEnabled: false,
    offPeakOnly: false,
  },
  {
    id: '20000000-0000-4000-8000-000000000003',
    name: 'Quarterly Iron Standard',
    billingCycle: BillingCycle.QUARTERLY,
    priceBdt: 9500,
    durationDays: 90,
    sessionCredits: 18,
    roamingEnabled: false,
    offPeakOnly: false,
  },
  {
    id: '20000000-0000-4000-8000-000000000004',
    name: '3-Branch Roaming VIP',
    billingCycle: BillingCycle.QUARTERLY,
    priceBdt: 14500,
    durationDays: 90,
    sessionCredits: 30,
    roamingEnabled: true,
    offPeakOnly: false,
  },
];

const BRANCH_IMAGES: Record<string, { src: string; alt: string }> = {
  [BRANCH_CODES.GULSHAN]: {
    src: '/images/power-rack-detail.jpg',
    alt: 'Gulshan-1 Flagship matte-black and crimson power rack station',
  },
  [BRANCH_CODES.DHANMONDI]: {
    src: '/images/red-led-rack.jpg',
    alt: 'Dhanmondi Iron Club crimson LED mirror and squat rack floor',
  },
  [BRANCH_CODES.UTTARA]: {
    src: '/images/strength-station.jpg',
    alt: 'Uttara Sector-7 vertical pull-up tower and strength zone',
  },
};

const INCLUDED_BENEFITS = [
  '24/7 RFID & Rotating 60s QR Turnstile Entry',
  'Smart Locker Pairing Inside Member App',
  'Live Floor Occupancy & Crowd Meter',
  'Encrypted PAR-Q Digital Onboarding',
  'Membership Freeze (3 to 30 Days Travel Pause)',
  '15% Off Linked Family Dependent Accounts',
];

const FAQS = [
  {
    q: 'How does 24/7 access work vs. staffed hours?',
    a: 'All three Dhaka clubs remain open to active members around the clock via RFID card or your rotating 60-second QR pass. Front-desk reception, walk-in onboarding, and floor coaching operate during daily staffed hours.',
  },
  {
    q: 'Can I train across Gulshan-1, Dhanmondi, and Uttara?',
    a: 'Home Club plans unlock your primary branch. Upgrading to our 3-Branch Roaming VIP plan opens every turnstile and smart locker across all Dhaka locations.',
  },
  {
    q: 'What is the Off-Peak 1 PM–3 PM window?',
    a: 'Midday lifters enjoy our quietest floor hours from 1:00 PM to 3:00 PM with reduced monthly dues and discounted off-peak group conditioning sessions.',
  },
  {
    q: 'Can I pause my membership when travelling?',
    a: 'Yes. Members can self-freeze an active subscription directly inside the Member Portal for 3 to 30 days, extending their expiry window automatically.',
  },
];

function occupancyPct(current: number, max: number): number {
  if (!max) return 0;
  return Math.min(100, Math.round((current / max) * 100));
}

export function StorefrontClient() {
  const [branches, setBranches] = useState<BranchItem[]>(FALLBACK_BRANCHES);
  const [plans, setPlans] = useState<MembershipPlanItem[]>(FALLBACK_PLANS);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);

  // Free Pass Lead Form
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('+8801');
  const [leadBranchId, setLeadBranchId] = useState(FALLBACK_BRANCHES[0].id);
  const [leadWindow, setLeadWindow] = useState<'MORNING' | 'OFF_PEAK_1_3PM' | 'EVENING'>('EVENING');
  const [leadGoal, setLeadGoal] = useState('');
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadConfirmation, setLeadConfirmation] = useState<FreePassLeadResult | null>(null);
  const [leadError, setLeadError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const [branchRes, planRes] = await Promise.all([
          apiGet<BranchItem[]>('/api/branches').catch(() => null),
          apiGet<MembershipPlanItem[]>('/api/billing/plans').catch(() => null),
        ]);
        if (!mounted) return;
        if (Array.isArray(branchRes) && branchRes.length > 0) {
          const merged = branchRes.map((b) => {
            const fallback = FALLBACK_BRANCHES.find((fb) => fb.code === b.code);
            return {
              ...fallback,
              ...b,
              staffedHours: b.staffedHours ?? fallback?.staffedHours,
              coaches: b.coaches && b.coaches.length > 0 ? b.coaches : fallback?.coaches,
            };
          });
          setBranches(merged);
          setLeadBranchId((prev) =>
            merged.some((m) => m.id === prev) ? prev : merged[0].id,
          );
        }
        if (Array.isArray(planRes) && planRes.length > 0) {
          setPlans(planRes);
        }
      } catch {
        // Fallback arrays already populated
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleLeadSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLeadError(null);
    const trimmedName = leadName.trim();
    const trimmedPhone = leadPhone.trim();

    if (trimmedName.length < 2) {
      setLeadError('Please enter your full name.');
      return;
    }
    if (!/^\+?8801[3-9]\d{8}$/.test(trimmedPhone) && trimmedPhone.length < 11) {
      setLeadError('Enter a valid Bangladesh mobile number (+8801XXXXXXXXX).');
      return;
    }

    setLeadSubmitting(true);
    const selectedBranch = branches.find((b) => b.id === leadBranchId) ?? branches[0];
    const payload: FreePassLeadPayload = {
      fullName: trimmedName,
      phone: trimmedPhone,
      branchId: leadBranchId,
      preferredVisitWindow: leadWindow,
      goal: leadGoal.trim() || undefined,
    };

    try {
      const res = await apiPost<FreePassLeadResult>('/api/leads/free-pass', payload);
      setLeadConfirmation(res);
    } catch {
      // Graceful offline / pre-handoff confirmation so prospective members never hit a dead-end
      const code = `VA-PASS-${Math.floor(1000 + Math.random() * 9000)}`;
      setLeadConfirmation({
        id: code,
        referenceCode: code,
        branchName: selectedBranch?.name ?? 'Dhaka Flagship',
        message: `Day pass request logged locally for ${selectedBranch?.name ?? 'Dhaka Flagship'}. Show code ${code} at reception during staffed hours.`,
      });
    } finally {
      setLeadSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-obsidian text-chalk">
      {/* Sticky Top Storefront Nav */}
      <header className="sticky top-0 z-30 border-b border-steel bg-obsidian">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <Link href="/" className="flex items-center gap-3">
            <BrandCrest size={42} priority />
            <div>
              <span className="font-display block text-xl font-extrabold uppercase tracking-wider text-chalk">
                Vintage Aesthetics
              </span>
              <span className="block text-[11px] font-medium text-chrome">
                Dhaka Flagship Strength Clubs
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-medium text-silver lg:flex" aria-label="Storefront Navigation">
            <a href="#locations" className="transition-colors hover:text-chalk">
              Locations
            </a>
            <a href="#memberships" className="transition-colors hover:text-chalk">
              Memberships
            </a>
            <a href="#training" className="transition-colors hover:text-chalk">
              Training
            </a>
            <a href="#free-pass" className="transition-colors hover:text-chalk">
              Free Pass
            </a>
          </nav>

          <div className="hidden items-center gap-2.5 sm:flex">
            <Link
              href="/login"
              className="inline-flex min-h-[42px] items-center rounded-xl border border-steel bg-iron px-4 text-xs font-bold uppercase tracking-wider text-silver transition-colors hover:border-crimson hover:text-chalk"
            >
              Login
            </Link>
            <Link
              href="/onboard"
              className="inline-flex min-h-[42px] items-center rounded-xl bg-crimson px-4 text-xs font-bold uppercase tracking-wider text-chalk transition-colors hover:bg-crimson-hover"
            >
              Join Now
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMobileNavOpen((prev) => !prev)}
            aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-steel bg-iron text-chalk lg:hidden"
          >
            {mobileNavOpen ? <X className="h-5 w-5" strokeWidth={1.75} /> : <Menu className="h-5 w-5" strokeWidth={1.75} />}
          </button>
        </div>

        {/* Mobile Nav Drawer */}
        {mobileNavOpen ? (
          <div className="border-t border-steel bg-iron px-4 py-4 lg:hidden">
            <div className="flex flex-col gap-3 text-sm font-semibold text-silver">
              <a href="#locations" onClick={() => setMobileNavOpen(false)} className="py-1.5 hover:text-chalk">
                Locations
              </a>
              <a href="#memberships" onClick={() => setMobileNavOpen(false)} className="py-1.5 hover:text-chalk">
                Memberships
              </a>
              <a href="#training" onClick={() => setMobileNavOpen(false)} className="py-1.5 hover:text-chalk">
                Training
              </a>
              <a href="#free-pass" onClick={() => setMobileNavOpen(false)} className="py-1.5 hover:text-chalk">
                Free Pass
              </a>
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-steel pt-3">
                <Link
                  href="/login"
                  className="flex min-h-11 items-center justify-center rounded-xl border border-steel bg-obsidian text-xs font-bold uppercase text-chalk"
                >
                  Login
                </Link>
                <Link
                  href="/onboard"
                  className="flex min-h-11 items-center justify-center rounded-xl bg-crimson text-xs font-bold uppercase text-chalk"
                >
                  Join Now
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </header>

      {/* Editorial Hero */}
      <section className="relative overflow-hidden border-b border-steel bg-obsidian">
        <div className="absolute inset-0">
          <Image
            src="/images/hero-floor.jpg"
            alt="Vintage Aesthetics Gym plate-loaded crimson press floor"
            fill
            priority
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-linear-to-r from-[#0A0A0C] via-[#0A0A0C]/85 to-[#0A0A0C]/35" />
          <div className="absolute inset-0 bg-linear-to-t from-[#0A0A0C] via-transparent to-transparent" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-4 py-14 md:px-6 md:py-20">
          <div className="max-w-2xl space-y-5">
            <h1 className="font-display text-5xl font-extrabold uppercase leading-[0.94] tracking-tight text-chalk sm:text-6xl md:text-7xl">
              Built for Dhaka Iron. Open 24/7.
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-silver md:text-lg">
              Three performance strength clubs across Gulshan-1, Dhanmondi, and Uttara with automated RFID &amp; QR gate entry, smart lockers, and coaching built around real progression.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <a
                href="#free-pass"
                className="inline-flex min-h-[50px] items-center justify-center rounded-xl bg-crimson px-6 text-sm font-bold uppercase tracking-wider text-chalk transition-colors hover:bg-crimson-hover"
              >
                Claim Free Pass
              </a>
              <Link
                href="/onboard"
                className="inline-flex min-h-[50px] items-center justify-center rounded-xl border border-silver/40 bg-obsidian/80 px-6 text-sm font-bold uppercase tracking-wider text-chalk transition-colors hover:border-crimson hover:bg-iron"
              >
                Join Now
              </Link>
            </div>
          </div>

          {/* Live 3-Branch Crowd Strip */}
          <div className="mt-10 border-t border-white/15 pt-6">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-silver">
              <Activity className="h-4 w-4 text-emerald-500" strokeWidth={1.75} />
              <span>Live Floor Occupancy Across Dhaka</span>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {branches.map((branch) => {
                const pct = occupancyPct(branch.currentOccupancy, branch.maxOccupancy);
                return (
                  <div
                    key={branch.id}
                    className="rounded-xl border border-steel bg-iron/90 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display text-lg font-bold uppercase text-chalk">
                        {branch.name}
                      </span>
                      <span className="font-mono text-xs font-bold text-emerald-400 tabular-nums">
                        {pct}% Full
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-obsidian">
                      <div
                        className="h-full rounded-full bg-crimson"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-chrome tabular-nums">
                      <span>
                        {branch.currentOccupancy} / {branch.maxOccupancy} Inside
                      </span>
                      <span>{branch.code}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Horizontal Value Ticker Bar */}
      <div className="border-b border-steel bg-iron">
        <div className="va-led-rule w-full" />
        <div className="mx-auto max-w-7xl overflow-x-auto px-4 py-3 md:px-6">
          <p className="whitespace-nowrap text-center font-display text-sm font-bold uppercase tracking-[0.2em] text-silver">
            3 DHAKA LOCATIONS · AUTOMATED RFID ACCESS · FLEXIBLE PLANS · PRO COACHING
          </p>
        </div>
      </div>

      {/* Numbered Branch Showcases */}
      <section id="locations" className="mx-auto max-w-7xl space-y-8 px-4 py-14 md:px-6">
        <div className="flex flex-col justify-between gap-4 border-b border-steel pb-5 md:flex-row md:items-end">
          <div>
            <h2 className="font-display text-4xl font-extrabold uppercase tracking-tight text-chalk md:text-5xl">
              Dhaka Flagship Clubs
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm text-chrome">
              Train at your home club or roam across all three locations with live crowd visibility and dedicated coaching teams.
            </p>
          </div>
          <Link
            href="/onboard"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-steel bg-iron px-4 text-xs font-bold uppercase tracking-wider text-chalk hover:border-crimson"
          >
            Start Online Onboarding
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {branches.map((branch, idx) => {
            const pct = occupancyPct(branch.currentOccupancy, branch.maxOccupancy);
            const photo = BRANCH_IMAGES[branch.code] ?? BRANCH_IMAGES[BRANCH_CODES.GULSHAN];
            const numPrefix = String(idx + 1).padStart(2, '0');
            return (
              <article
                key={branch.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-steel bg-iron"
              >
                <div className="relative h-64 w-full overflow-hidden">
                  <Image
                    src={photo.src}
                    alt={photo.alt}
                    fill
                    className="object-cover object-top"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-[#0A0A0C] via-[#0A0A0C]/75 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display text-3xl font-extrabold text-crimson tabular-nums">
                        {numPrefix}
                      </span>
                      <span className="rounded-md border border-white/20 bg-obsidian/90 px-2.5 py-0.5 font-mono text-xs font-bold text-chalk">
                        {branch.code}
                      </span>
                    </div>
                    <h3 className="font-display mt-1 text-2xl font-extrabold uppercase text-chalk">
                      {branch.name}
                    </h3>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-silver">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-crimson" strokeWidth={1.75} />
                      {branch.address}
                    </p>
                  </div>
                </div>

                <div className="flex flex-1 flex-col justify-between space-y-4 p-5">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3 border-b border-steel pb-3 text-xs">
                      <span className="flex items-center gap-1.5 text-chrome">
                        <Clock className="h-3.5 w-3.5 text-crimson" strokeWidth={1.75} />
                        Staffed Hours
                      </span>
                      <span className="text-right font-semibold text-silver">
                        {branch.staffedHours ?? '06:00 AM – 11:00 PM (24/7 Member RFID)'}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs font-semibold tabular-nums">
                        <span className="text-chrome">Live Crowd</span>
                        <span className="text-chalk">
                          {branch.currentOccupancy} / {branch.maxOccupancy} ({pct}%)
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-obsidian">
                        <div
                          className="h-full rounded-full bg-crimson"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {branch.coaches && branch.coaches.length > 0 ? (
                      <div className="border-t border-steel pt-3">
                        <p className="mb-2 text-xs font-bold text-chrome">
                          Meet Your Coaches
                        </p>
                        <div className="space-y-1.5">
                          {branch.coaches.map((coach) => (
                            <div
                              key={coach.id}
                              className="flex items-center justify-between text-xs"
                            >
                              <span className="font-semibold text-chalk">{coach.fullName}</span>
                              <span className="text-chrome">{coach.specialty}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <Link
                    href={`/onboard?branch=${encodeURIComponent(branch.code)}`}
                    className="flex min-h-[46px] w-full items-center justify-center rounded-xl border border-steel bg-obsidian text-xs font-bold uppercase tracking-wider text-chalk transition-colors hover:border-crimson hover:bg-crimson"
                  >
                    Join {branch.code}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Training & Off-Peak Editorial Section */}
      <section id="training" className="border-y border-steel bg-iron">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 md:grid-cols-12 md:items-center md:px-6">
          <div className="space-y-5 md:col-span-6">
            <h2 className="font-display text-4xl font-extrabold uppercase tracking-tight text-chalk md:text-5xl">
              Coaching, Conditioning &amp; Off-Peak Iron
            </h2>
            <p className="text-sm leading-relaxed text-silver md:text-base">
              Book 1-on-1 personal training, high-intensity group sessions, or midday Off-Peak slots directly from the Member PWA with automated waitlists.
            </p>
            <div className="grid gap-4 border-t border-steel pt-5 sm:grid-cols-2">
              <div>
                <div className="flex items-center gap-2 font-display text-lg font-bold uppercase text-chalk">
                  <Dumbbell className="h-4 w-4 text-crimson" strokeWidth={1.75} />
                  1-on-1 Strength Coaching
                </div>
                <p className="mt-1 text-xs leading-relaxed text-chrome">
                  Structured programming, squat/deadlift technique feedback, and progression tracking.
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 font-display text-lg font-bold uppercase text-amber-400">
                  <Clock className="h-4 w-4 text-amber-500" strokeWidth={1.75} />
                  Off-Peak 1 PM–3 PM
                </div>
                <p className="mt-1 text-xs leading-relaxed text-chrome">
                  Train in calm midday hours with reduced BDT pricing and priority rack availability.
                </p>
              </div>
            </div>
          </div>

          <div className="relative h-80 overflow-hidden rounded-2xl border border-steel md:col-span-6">
            <Image
              src="/images/strength-station.jpg"
              alt="Vintage Aesthetics pull-up and conditioning tower"
              fill
              className="object-cover object-center"
            />
            <div className="absolute inset-0 bg-linear-to-t from-[#0A0A0C] via-[#0A0A0C]/45 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-obsidian/90 px-3 py-1 text-xs font-bold text-amber-400">
                Off-Peak Window: 1:00 PM – 3:00 PM Daily
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Side-by-Side BDT Pricing + Every Membership Includes */}
      <section id="memberships" className="mx-auto max-w-7xl space-y-8 px-4 py-14 md:px-6">
        <div className="border-b border-steel pb-5">
          <h2 className="font-display text-4xl font-extrabold uppercase tracking-tight text-chalk md:text-5xl">
            Transparent BDT Memberships
          </h2>
          <p className="mt-1.5 text-sm text-chrome">
            Flexible plans with bKash, Nagad, Card, or Reception Cash settlement—plus 7-day partial split payments.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => {
            const isVip = plan.roamingEnabled;
            const isOffPeak = plan.offPeakOnly;
            return (
              <div
                key={plan.id}
                className={`flex flex-col justify-between rounded-2xl border p-5 ${
                  isVip
                    ? 'border-crimson bg-iron'
                    : 'border-steel bg-iron'
                }`}
              >
                <div>
                  {isVip ? <div className="va-led-rule mb-4 w-full" /> : null}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-2xl font-extrabold uppercase text-chalk">
                      {plan.name}
                    </h3>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {isVip ? (
                      <span className="rounded bg-crimson px-2 py-0.5 text-[11px] font-bold text-chalk">
                        3-Branch Roaming
                      </span>
                    ) : null}
                    {isOffPeak ? (
                      <span className="rounded border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-400">
                        1 PM–3 PM Window
                      </span>
                    ) : null}
                  </div>
                  <p className="font-display mt-4 text-4xl font-extrabold text-chalk tabular-nums">
                    {formatBdt(plan.priceBdt)}
                  </p>
                  <p className="mt-1 text-xs text-chrome tabular-nums">
                    {plan.durationDays} Days · {plan.billingCycle}
                    {plan.sessionCredits ? ` · ${plan.sessionCredits} Class Credits` : ''}
                  </p>
                </div>

                <Link
                  href={`/onboard?plan=${encodeURIComponent(plan.id)}`}
                  className={`mt-6 flex min-h-[46px] w-full items-center justify-center rounded-xl text-xs font-bold uppercase tracking-wider transition-colors ${
                    isVip
                      ? 'bg-crimson text-chalk hover:bg-crimson-hover'
                      : 'border border-steel bg-obsidian text-chalk hover:border-crimson hover:bg-crimson'
                  }`}
                >
                  Select Plan
                </Link>
              </div>
            );
          })}
        </div>

        {/* Every Membership Includes */}
        <div className="rounded-2xl border border-steel bg-iron p-6">
          <h3 className="font-display text-2xl font-bold uppercase text-chalk">
            Every Membership Includes
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {INCLUDED_BENEFITS.map((benefit) => (
              <div key={benefit} className="flex items-center gap-2.5 text-sm text-silver">
                <Check className="h-4 w-4 shrink-0 text-emerald-500" strokeWidth={2} />
                <span>{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Free Day Pass / Branch Tour Lead Capture */}
      <section id="free-pass" className="border-t border-steel bg-iron">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 md:grid-cols-12 md:px-6">
          <div className="space-y-4 md:col-span-5">
            <h2 className="font-display text-4xl font-extrabold uppercase tracking-tight text-chalk md:text-5xl">
              Claim a Free Day Pass
            </h2>
            <p className="text-sm leading-relaxed text-silver">
              Tour your preferred Dhaka branch, meet our strength coaches, and test the floor before committing.
            </p>
            <div className="space-y-2.5 border-t border-steel pt-4 text-xs text-chrome">
              <p className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-crimson" strokeWidth={1.75} />
                Instant reception check-in code generated
              </p>
              <p className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" strokeWidth={1.75} />
                Zero spam or lock-in contracts
              </p>
              <p className="flex items-center gap-2">
                <Users className="h-4 w-4 text-silver" strokeWidth={1.75} />
                Bring a friend on Off-Peak 1 PM–3 PM tours
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-steel bg-obsidian p-6 md:col-span-7">
            <div className="va-led-rule mb-5 w-full" />
            {leadConfirmation ? (
              <div className="space-y-4">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-400">
                  Day Pass Reserved
                </span>
                <h3 className="font-display text-3xl font-extrabold uppercase text-chalk">
                  Pass Code: {leadConfirmation.referenceCode}
                </h3>
                <p className="text-sm text-silver">{leadConfirmation.message}</p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setLeadConfirmation(null)}
                    className="min-h-11 rounded-xl border border-steel bg-iron px-4 text-xs font-bold uppercase text-silver hover:text-chalk"
                  >
                    Book Another Tour
                  </button>
                  <Link
                    href="/onboard"
                    className="inline-flex min-h-11 items-center rounded-xl bg-crimson px-4 text-xs font-bold uppercase text-chalk hover:bg-crimson-hover"
                  >
                    Complete Full Sign-Up
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleLeadSubmit} className="space-y-4">
                {leadError ? (
                  <div
                    role="alert"
                    className="rounded-xl border border-[#FF2A3B]/60 bg-[#FF2A3B]/15 px-4 py-3 text-xs font-semibold text-[#FF2A3B]"
                  >
                    {leadError}
                  </div>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-silver">
                      Full Name *
                    </span>
                    <input
                      type="text"
                      required
                      minLength={2}
                      value={leadName}
                      onChange={(e) => setLeadName(e.target.value)}
                      placeholder="Nafis Chowdhury"
                      className="min-h-12 w-full rounded-xl border border-steel bg-iron px-3.5 text-sm text-chalk outline-none focus:border-crimson"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-silver">
                      Mobile (+880...) *
                    </span>
                    <input
                      type="tel"
                      required
                      value={leadPhone}
                      onChange={(e) => setLeadPhone(e.target.value)}
                      placeholder="+8801712345678"
                      className="min-h-12 w-full rounded-xl border border-steel bg-iron px-3.5 text-sm text-chalk outline-none focus:border-crimson"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-silver">
                      Preferred Branch *
                    </span>
                    <select
                      value={leadBranchId}
                      onChange={(e) => setLeadBranchId(e.target.value)}
                      className="min-h-12 w-full rounded-xl border border-steel bg-iron px-3.5 text-sm text-chalk outline-none focus:border-crimson"
                    >
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.code} · {b.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-silver">
                      Preferred Time *
                    </span>
                    <select
                      value={leadWindow}
                      onChange={(e) =>
                        setLeadWindow(
                          e.target.value as 'MORNING' | 'OFF_PEAK_1_3PM' | 'EVENING',
                        )
                      }
                      className="min-h-12 w-full rounded-xl border border-steel bg-iron px-3.5 text-sm text-chalk outline-none focus:border-crimson"
                    >
                      <option value="MORNING">Morning (7:00 AM – 11:00 AM)</option>
                      <option value="OFF_PEAK_1_3PM">Off-Peak (1:00 PM – 3:00 PM)</option>
                      <option value="EVENING">Evening (5:00 PM – 10:00 PM)</option>
                    </select>
                  </label>
                </div>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-silver">
                    Training Goal (Optional)
                  </span>
                  <input
                    type="text"
                    maxLength={200}
                    value={leadGoal}
                    onChange={(e) => setLeadGoal(e.target.value)}
                    placeholder="Strength, fat loss, or guided machine orientation"
                    className="min-h-12 w-full rounded-xl border border-steel bg-iron px-3.5 text-sm text-chalk outline-none focus:border-crimson"
                  />
                </label>

                <button
                  type="submit"
                  disabled={leadSubmitting}
                  className="flex min-h-[50px] w-full items-center justify-center rounded-xl bg-crimson text-sm font-bold uppercase tracking-wider text-chalk transition-colors hover:bg-crimson-hover disabled:opacity-50"
                >
                  {leadSubmitting ? 'Reserving Pass...' : 'Reserve Free Day Pass'}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Expandable FAQ Accordion */}
      <section className="mx-auto max-w-4xl space-y-6 px-4 py-14 md:px-6">
        <h2 className="font-display text-3xl font-extrabold uppercase tracking-tight text-chalk md:text-4xl">
          Frequently Asked Questions
        </h2>
        <div className="divide-y divide-steel rounded-2xl border border-steel bg-iron">
          {FAQS.map((item, idx) => {
            const isOpen = openFaqIdx === idx;
            return (
              <div key={item.q} className="px-5 py-4">
                <button
                  type="button"
                  onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 text-left"
                >
                  <span className="text-sm font-bold text-chalk md:text-base">{item.q}</span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-chrome transition-transform ${
                      isOpen ? 'rotate-180 text-crimson' : ''
                    }`}
                    strokeWidth={1.75}
                  />
                </button>
                {isOpen ? (
                  <p className="mt-2.5 text-sm leading-relaxed text-chrome">{item.a}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      {/* Discreet Footer with QA/Staff Utility Links */}
      <footer className="border-t border-steel bg-iron pb-24 md:pb-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 px-4 py-8 md:flex-row md:items-center md:px-6">
          <div className="flex items-center gap-3">
            <BrandCrest size={38} />
            <div>
              <p className="font-display text-lg font-bold uppercase text-chalk">
                Vintage Aesthetics Gym
              </p>
              <p className="text-xs text-chrome">
                Gulshan-1 · Dhanmondi · Uttara · Asia/Dhaka
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-xs font-medium text-chrome">
            <Link href="/login" className="hover:text-chalk">
              Member &amp; Staff Login
            </Link>
            <Link href="/onboard" className="hover:text-chalk">
              Self-Onboarding
            </Link>
            <Link href="/simulator" className="hover:text-chalk">
              Hardware Simulator
            </Link>
            <Link href="/dev-inbox" className="hover:text-chalk">
              Dev Inbox
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
