'use client';

import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eraser,
  HeartPulse,
  Inbox,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { AuthSessionResponse, RegisterDto, VerifyOtpDto } from '@vintage/shared';
import { ApiError, apiGet, apiPost } from '@/lib/api';
import { formatBdt } from '@/lib/dal';
import type { BranchItem, MembershipPlanItem } from '@/lib/types';
import { MockCheckoutModal } from '@/components/billing/MockCheckoutModal';

type OnboardStep = 1 | 2 | 3 | 4;

export default function OnboardPage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  const [step, setStep] = useState<OnboardStep>(1);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [plans, setPlans] = useState<MembershipPlanItem[]>([]);

  // Step 1: Details & Branch
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+8801');
  const [password, setPassword] = useState('');
  const [homeBranchId, setHomeBranchId] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');

  // Step 2: PAR-Q & Canvas Waiver Signature
  const [hasHeartCondition, setHasHeartCondition] = useState(false);
  const [hasChestPain, setHasChestPain] = useState(false);
  const [hasJointInjury, setHasJointInjury] = useState(false);
  const [fitnessGoal, setFitnessGoal] = useState('Hypertrophy & Conditioning');
  const [hasSigned, setHasSigned] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string>('');

  // Step 3: OTP Verification
  const [devOtpPreview, setDevOtpPreview] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [registeredUserId, setRegisteredUserId] = useState<string | undefined>(undefined);

  // Step 4: Plan & MockCheckoutModal
  const [selectedPlan, setSelectedPlan] = useState<MembershipPlanItem | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [branchList, planList] = await Promise.all([
          apiGet<BranchItem[]>('/api/branches'),
          apiGet<MembershipPlanItem[]>('/api/billing/plans'),
        ]);
        setBranches(branchList);
        setPlans(planList);
        if (branchList[0]) setHomeBranchId(branchList[0].id);
        if (planList[0]) setSelectedPlan(planList[0]);
      } catch {
        // Handled cleanly if backend not yet online
      }
    })();
  }, []);

  // Initialize signature canvas background
  useEffect(() => {
    if (step !== 2 || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#0A0A0C';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#FAFAFA';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [step]);

  const getCanvasPoint = (e: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const { x, y } = getCanvasPoint(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handlePointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCanvasPoint(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSigned(true);
  };

  const handlePointerUp = () => {
    if (!drawingRef.current || !canvasRef.current) return;
    drawingRef.current = false;
    setSignatureDataUrl(canvasRef.current.toDataURL('image/png'));
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#0A0A0C';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
    setSignatureDataUrl('');
  };

  const handleStep1Submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!homeBranchId) {
      setError('Please select a home branch.');
      return;
    }
    if (password.length < 10) {
      setError('Password must be at least 10 characters (NIST SP 800-63B).');
      return;
    }
    setStep(2);
  };

  const handleRegisterSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!hasSigned) {
      setError('Please sign the digital PAR-Q liability waiver on the canvas.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: RegisterDto = {
        fullName: fullName.trim(),
        email: email.trim() ? email.trim() : undefined,
        phone: phone.trim(),
        password,
        homeBranchId,
        emergencyContact: emergencyContact.trim() || undefined,
        parqData: {
          hasHeartCondition,
          hasChestPain,
          hasJointInjury,
          fitnessGoal: fitnessGoal.trim() || undefined,
          waiverSignatureDataUrl:
            signatureDataUrl || canvasRef.current?.toDataURL('image/png') || undefined,
        },
      };

      const res = await apiPost<AuthSessionResponse>('/api/auth/register', payload);
      setRegisteredUserId(res.user.id);
      if (res.devOtpPreview) {
        setDevOtpPreview(res.devOtpPreview);
        setOtpCode(res.devOtpPreview);
      }
      setStep(3);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload: VerifyOtpDto = {
        identifier: email.trim() || phone.trim(),
        code: otpCode.trim(),
      };
      const res = await apiPost<AuthSessionResponse>('/api/auth/verify-otp', payload);
      setRegisteredUserId(res.user.id);
      setStep(4);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Invalid or expired OTP code.');
    } finally {
      setSubmitting(false);
    }
  };

  const steps = [
    { num: 1, label: 'Details & Branch' },
    { num: 2, label: 'PAR-Q & Waiver' },
    { num: 3, label: 'OTP Verification' },
    { num: 4, label: 'Plan & Checkout' },
  ] as const;

  return (
    <main className="min-h-screen bg-obsidian px-4 py-8 text-chalk md:px-6 md:py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/login"
            className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border border-steel bg-iron px-4 py-2 text-xs font-bold uppercase tracking-wider text-silver hover:border-crimson hover:text-chalk"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Login
          </Link>
          <Link
            href="/dev-inbox"
            className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border border-steel bg-iron px-4 py-2 text-xs font-bold uppercase tracking-wider text-amber-400 hover:border-amber-400"
          >
            <Inbox className="h-4 w-4" />
            Open Dev Inbox
          </Link>
        </div>

        {/* Header + Stepper */}
        <section className="va-card va-hero-gradient rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <Image
              src="/images/logo.png"
              alt="Vintage Aesthetics Gym"
              width={54}
              height={54}
              className="rounded-full border border-chrome/40 bg-obsidian p-0.5"
            />
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-chrome">
                Zero-Paperwork Digital Join
              </p>
              <h1 className="font-display text-3xl font-extrabold uppercase text-chalk">
                Member Self-Onboarding
              </h1>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {steps.map((s) => {
              const active = step === s.num;
              const done = step > s.num;
              return (
                <div
                  key={s.num}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${
                    active
                      ? 'border-crimson bg-crimson/20 text-chalk'
                      : done
                        ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                        : 'border-steel bg-obsidian/70 text-chrome'
                  }`}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-obsidian text-[11px]">
                    {done ? '✓' : s.num}
                  </span>
                  <span className="truncate">{s.label}</span>
                </div>
              );
            })}
          </div>
        </section>

        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-[#FF2A3B]/60 bg-[#FF2A3B]/15 p-4 text-sm font-semibold text-[#FF2A3B]"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {/* STEP 1: DETAILS & BRANCH */}
        {step === 1 ? (
          <form onSubmit={handleStep1Submit} className="va-card space-y-4 rounded-2xl p-6">
            <h2 className="font-display text-2xl font-bold uppercase text-chalk">
              1. Personal Details & Home Branch
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-silver">
                  Full Name *
                </span>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ayesha Siddiqua"
                  className="min-h-[48px] w-full rounded-xl border border-steel bg-obsidian px-4 text-sm text-chalk outline-none focus:border-crimson"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-silver">
                  Bangladesh Mobile (+880...) *
                </span>
                <input
                  type="tel"
                  required
                  minLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+8801712345678"
                  className="min-h-[48px] w-full rounded-xl border border-steel bg-obsidian px-4 text-sm text-chalk outline-none focus:border-crimson"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-silver">
                  Email Address
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ayesha@example.com"
                  className="min-h-[48px] w-full rounded-xl border border-steel bg-obsidian px-4 text-sm text-chalk outline-none focus:border-crimson"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-silver">
                  Home Branch *
                </span>
                <select
                  required
                  value={homeBranchId}
                  onChange={(e) => setHomeBranchId(e.target.value)}
                  className="min-h-[48px] w-full rounded-xl border border-steel bg-obsidian px-4 text-sm text-chalk outline-none focus:border-crimson"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} • {b.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-silver">
                  Password (Min 10 Chars) *
                </span>
                <input
                  type="password"
                  required
                  minLength={10}
                  maxLength={128}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 10 characters"
                  className="min-h-[48px] w-full rounded-xl border border-steel bg-obsidian px-4 text-sm text-chalk outline-none focus:border-crimson"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-silver">
                  Emergency Contact
                </span>
                <input
                  type="text"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  placeholder="Rahim (+8801711000000)"
                  className="min-h-[48px] w-full rounded-xl border border-steel bg-obsidian px-4 text-sm text-chalk outline-none focus:border-crimson"
                />
              </label>
            </div>

            <button
              type="submit"
              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-crimson px-5 py-3 text-sm font-bold uppercase tracking-wider text-chalk hover:bg-crimson-hover"
            >
              Continue to PAR-Q Health Waiver
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        ) : null}

        {/* STEP 2: PAR-Q HEALTH QUESTIONS + CANVAS SIGNATURE */}
        {step === 2 ? (
          <form onSubmit={handleRegisterSubmit} className="va-card space-y-5 rounded-2xl p-6">
            <div className="flex items-center gap-3">
              <HeartPulse className="h-6 w-6 text-crimson" />
              <div>
                <h2 className="font-display text-2xl font-bold uppercase text-chalk">
                  2. Encrypted PAR-Q Health Screening & Signature
                </h2>
                <p className="text-xs text-chrome">
                  Protected with AES-256-GCM at rest. Sign using mouse or finger below.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {[
                {
                  label: 'Do you have any known heart or cardiovascular condition?',
                  checked: hasHeartCondition,
                  onChange: setHasHeartCondition,
                },
                {
                  label: 'Do you experience chest pain or dizziness during physical exertion?',
                  checked: hasChestPain,
                  onChange: setHasChestPain,
                },
                {
                  label: 'Do you have a joint, spine, or knee injury requiring trainer modification?',
                  checked: hasJointInjury,
                  onChange: setHasJointInjury,
                },
              ].map((q) => (
                <label
                  key={q.label}
                  className="flex min-h-[52px] cursor-pointer items-center justify-between gap-4 rounded-xl border border-steel bg-obsidian/70 px-4 py-3"
                >
                  <span className="text-sm text-silver">{q.label}</span>
                  <input
                    type="checkbox"
                    checked={q.checked}
                    onChange={(e) => q.onChange(e.target.checked)}
                    className="h-5 w-5 shrink-0 accent-crimson"
                  />
                </label>
              ))}
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-silver">
                Primary Training Goal
              </span>
              <input
                type="text"
                value={fitnessGoal}
                onChange={(e) => setFitnessGoal(e.target.value)}
                className="min-h-[48px] w-full rounded-xl border border-steel bg-obsidian px-4 text-sm text-chalk outline-none focus:border-crimson"
              />
            </label>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-silver">
                  Digital Liability Waiver Signature *
                </span>
                <button
                  type="button"
                  onClick={clearSignature}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-steel bg-obsidian px-3 text-xs font-semibold text-chrome hover:text-chalk"
                >
                  <Eraser className="h-3.5 w-3.5" />
                  Clear Signature
                </button>
              </div>
              <canvas
                ref={canvasRef}
                width={620}
                height={180}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                className="h-44 w-full touch-none rounded-xl border border-chrome/40 bg-obsidian cursor-crosshair"
              />
              <p className="mt-1.5 text-[11px] text-chrome">
                {hasSigned
                  ? 'Signature captured. Ready to submit registration.'
                  : 'Draw your signature inside the box above.'}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="min-h-[52px] rounded-xl border border-steel bg-obsidian px-5 text-sm font-bold text-silver hover:text-chalk"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl bg-crimson px-5 text-sm font-bold uppercase tracking-wider text-chalk hover:bg-crimson-hover disabled:opacity-50"
              >
                {submitting ? 'Creating Account...' : 'Submit & Get OTP'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </form>
        ) : null}

        {/* STEP 3: OTP VERIFICATION PREVIEW */}
        {step === 3 ? (
          <form onSubmit={handleVerifyOtp} className="va-card space-y-5 rounded-2xl p-6">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-6 w-6 text-emerald-400" />
              <div>
                <h2 className="font-display text-2xl font-bold uppercase text-chalk">
                  3. Verify 6-Digit OTP
                </h2>
                <p className="text-xs text-chrome">
                  Zero-cost OTP dispatched to your free local Dev Inbox.
                </p>
              </div>
            </div>

            {devOtpPreview ? (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
                  <Sparkles className="h-4 w-4" />
                  Free Dev OTP Preview
                </p>
                <p className="mt-1 font-display text-3xl font-extrabold tracking-[0.25em] text-chalk">
                  {devOtpPreview}
                </p>
              </div>
            ) : null}

            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-silver">
                Enter 6-Digit Code
              </span>
              <input
                type="text"
                required
                maxLength={6}
                minLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="123456"
                className="min-h-[56px] w-full rounded-xl border border-steel bg-obsidian px-4 text-center font-display text-3xl font-extrabold tracking-[0.35em] text-chalk outline-none focus:border-crimson"
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-crimson px-5 text-sm font-bold uppercase tracking-wider text-chalk hover:bg-crimson-hover disabled:opacity-50"
            >
              {submitting ? 'Verifying...' : 'Verify OTP & Choose Plan'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        ) : null}

        {/* STEP 4: PLAN & PROMO -> MOCK CHECKOUT */}
        {step === 4 ? (
          <section className="va-card space-y-5 rounded-2xl p-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              <div>
                <h2 className="font-display text-2xl font-bold uppercase text-chalk">
                  4. Select Membership Plan & Checkout
                </h2>
                <p className="text-xs text-chrome">
                  Account verified! Activate your membership using bKash, Nagad, or Card sandbox.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {plans.map((plan) => {
                const active = selectedPlan?.id === plan.id;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedPlan(plan)}
                    className={`min-h-[112px] rounded-xl border p-4 text-left transition-all ${
                      active
                        ? 'border-crimson bg-oxblood/30 text-chalk'
                        : 'border-steel bg-obsidian/80 text-silver hover:border-chrome/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-display text-xl font-bold uppercase text-chalk">
                        {plan.name}
                      </span>
                      {plan.roamingEnabled ? (
                        <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                          3-Branch VIP
                        </span>
                      ) : null}
                    </div>
                    <p className="font-display mt-2 text-2xl font-extrabold text-crimson">
                      {formatBdt(plan.priceBdt)}
                    </p>
                    <p className="mt-1 text-xs text-chrome">
                      {plan.durationDays} Days • {plan.billingCycle}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={!selectedPlan}
                onClick={() => setCheckoutOpen(true)}
                className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl bg-crimson px-5 text-sm font-bold uppercase tracking-wider text-chalk hover:bg-crimson-hover disabled:opacity-50"
              >
                Open Mock Checkout
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => router.push('/member')}
                className="min-h-[52px] rounded-xl border border-steel bg-obsidian px-5 text-sm font-bold text-silver hover:text-chalk"
              >
                Skip to Member PWA
              </button>
            </div>
          </section>
        ) : null}
      </div>

      <MockCheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        plan={selectedPlan}
        targetUserId={registeredUserId}
        targetUserName={fullName}
        onSuccess={() => {
          setTimeout(() => {
            setCheckoutOpen(false);
            router.push('/member');
          }, 1000);
        }}
      />
    </main>
  );
}
