'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  Building2,
  CreditCard,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  ShieldCheck,
  Sun,
  Terminal,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
import { UserRole, type AuthUserProfile } from '@vintage/shared';
import { logoutAndWipe } from '@/lib/dal';
import type { BranchItem } from '@/lib/types';

export interface PortalNavItem {
  label: string;
  href: string;
  icon: 'desk' | 'admin' | 'users' | 'billing' | 'simulator' | 'inbox';
  badge?: string;
}

interface PortalShellProps {
  user: AuthUserProfile;
  branches: BranchItem[];
  selectedBranchId: string;
  onSelectBranch?: (branchId: string) => void;
  lightMode: boolean;
  onToggleLightMode: () => void;
  title: string;
  subtitle?: string;
  headerActions?: ReactNode;
  children: ReactNode;
}

const DEFAULT_NAV: PortalNavItem[] = [
  { label: 'Live Access', href: '/desk', icon: 'desk' },
  { label: 'Super Admin', href: '/admin', icon: 'admin' },
  { label: 'Member PWA', href: '/member', icon: 'users' },
  { label: 'Trainer PWA', href: '/trainer', icon: 'billing' },
  { label: 'Simulator', href: '/simulator', icon: 'simulator' },
  { label: 'Dev Inbox', href: '/dev-inbox', icon: 'inbox' },
];

function renderNavIcon(icon: PortalNavItem['icon']) {
  switch (icon) {
    case 'desk':
      return <ShieldCheck className="h-5 w-5" aria-hidden="true" />;
    case 'admin':
      return <LayoutDashboard className="h-5 w-5" aria-hidden="true" />;
    case 'users':
      return <Users className="h-5 w-5" aria-hidden="true" />;
    case 'billing':
      return <CreditCard className="h-5 w-5" aria-hidden="true" />;
    case 'simulator':
      return <Terminal className="h-5 w-5" aria-hidden="true" />;
    case 'inbox':
    default:
      return <Inbox className="h-5 w-5" aria-hidden="true" />;
  }
}

export function PortalShell({
  user,
  branches,
  selectedBranchId,
  onSelectBranch,
  lightMode,
  onToggleLightMode,
  title,
  subtitle,
  headerActions,
  children,
}: PortalShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [browserOffline, setBrowserOffline] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setBrowserOffline(!navigator.onLine);
    const goOffline = () => setBrowserOffline(true);
    const goOnline = () => setBrowserOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  const activeBranch =
    branches.find((b) => b.id === selectedBranchId) ?? branches[0] ?? null;

  const anyBranchOffline = branches.some((b) => !b.edgeNodeOnline);
  const showOfflineBanner = browserOffline || anyBranchOffline;
  const canSwitchBranch = user.role === UserRole.SUPER_ADMIN && Boolean(onSelectBranch);

  const visibleNav = DEFAULT_NAV.filter((item) => {
    if (item.href === '/admin' && user.role !== UserRole.SUPER_ADMIN) {
      return false;
    }
    return true;
  });

  const handleLogout = async () => {
    setLoggingOut(true);
    await logoutAndWipe();
    router.push('/login');
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#0F0F12] text-chalk">
      {/* Oxblood & Obsidian Crest Header */}
      <div className="border-b border-steel bg-gradient-to-br from-oxblood via-[#3A090D] to-[#0F0F12] p-4">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/images/logo.png"
            alt="Vintage Aesthetics Gym"
            width={44}
            height={44}
            className="rounded-full border border-chrome/30 bg-obsidian p-0.5"
          />
          <div className="min-w-0">
            <p className="font-display text-lg font-extrabold uppercase leading-tight tracking-wide text-chalk">
              Vintage Aesthetics
            </p>
            <p className="truncate text-[11px] font-medium uppercase tracking-widest text-silver/80">
              {user.role.replace('_', ' ')}
            </p>
          </div>
        </Link>

        {/* Branch Badge / Switcher */}
        <div className="mt-4">
          {canSwitchBranch ? (
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-silver/70">
                Active Branch Scope
              </span>
              <select
                value={selectedBranchId}
                onChange={(e) => onSelectBranch?.(e.target.value)}
                className="min-h-[44px] w-full rounded-lg border border-steel bg-obsidian/90 px-3 py-2 text-xs font-semibold text-chalk outline-none focus:border-crimson"
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.code} • {branch.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="flex items-center justify-between rounded-lg border border-white/15 bg-obsidian/70 px-3 py-2">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-crimson" aria-hidden="true" />
                <span className="text-xs font-bold tracking-wide text-chalk">
                  {activeBranch ? `${activeBranch.code} • ${activeBranch.name}` : 'Branch Locked'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1.5 overflow-y-auto p-3" aria-label="Portal Navigation">
        {visibleNav.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex min-h-[48px] items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                isActive
                  ? 'bg-crimson text-chalk shadow-lg shadow-crimson/25'
                  : 'text-chrome hover:bg-iron hover:text-chalk'
              }`}
            >
              <span className="flex items-center gap-3">
                {renderNavIcon(item.icon)}
                {item.label}
              </span>
              {item.badge ? (
                <span className="rounded-full bg-oxblood px-2 py-0.5 text-[10px] font-bold">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* Operator Footer + Logout */}
      <div className="border-t border-steel p-3">
        <div className="mb-3 rounded-xl border border-steel bg-iron/80 px-3 py-2.5">
          <p className="truncate text-xs font-bold text-chalk">{user.fullName}</p>
          <p className="truncate text-[11px] text-chrome">{user.email ?? user.phone}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-steel bg-iron px-4 py-2.5 text-sm font-semibold text-silver transition-colors hover:border-crimson/60 hover:bg-oxblood/40 hover:text-chalk disabled:opacity-50"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          {loggingOut ? 'Signing Out...' : 'Logout & Wipe Cache'}
        </button>
      </div>
    </div>
  );

  return (
    <div
      className={`min-h-screen transition-colors ${
        lightMode ? 'bg-[#F4F4F6] text-zinc-900' : 'bg-obsidian text-chalk'
      }`}
    >
      {/* Desktop Fixed 240px Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[240px] border-r border-steel lg:block">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/70"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10 w-[260px] max-w-[85vw] border-r border-steel">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close navigation menu"
              className="absolute top-3 right-3 z-20 flex h-10 w-10 items-center justify-center rounded-lg bg-obsidian/80 text-chalk"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarContent}
          </div>
        </div>
      ) : null}

      {/* Main Workspace */}
      <div className="flex min-h-screen flex-col lg:pl-[240px]">
        {/* Persistent Amber Offline Banner */}
        {showOfflineBanner ? (
          <div
            role="alert"
            className="flex items-center justify-center gap-2 border-b border-amber-500/40 bg-amber-500 px-4 py-2 text-xs font-bold uppercase tracking-wider text-zinc-950"
          >
            <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Offline Mode — Local Queue Active
              {anyBranchOffline ? ' (Edge Node Disconnected — Sync Pending)' : ''}
            </span>
          </div>
        ) : null}

        {/* Top Bar */}
        <header
          className={`sticky top-0 z-20 border-b px-4 py-3 backdrop-blur-md md:px-6 ${
            lightMode
              ? 'border-zinc-200 bg-white/95 text-zinc-900'
              : 'border-steel bg-iron/95 text-chalk'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open navigation menu"
                className={`flex h-12 w-12 items-center justify-center rounded-xl border lg:hidden ${
                  lightMode
                    ? 'border-zinc-200 bg-zinc-50 text-zinc-800'
                    : 'border-steel bg-obsidian text-chalk'
                }`}
              >
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <h1 className="font-display text-2xl font-extrabold uppercase tracking-wide md:text-3xl">
                  {title}
                </h1>
                {subtitle ? (
                  <p className={`text-xs ${lightMode ? 'text-zinc-500' : 'text-chrome'}`}>
                    {subtitle}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Live Occupancy Counter */}
              {activeBranch ? (
                <div
                  className={`flex min-h-[44px] items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-bold ${
                    lightMode
                      ? 'border-zinc-200 bg-zinc-50 text-zinc-800'
                      : 'border-steel bg-obsidian text-chalk'
                  }`}
                >
                  <Users className="h-4 w-4 text-crimson" aria-hidden="true" />
                  <span className="font-display text-base">
                    {activeBranch.currentOccupancy} / {activeBranch.maxOccupancy}
                  </span>
                  <span className={lightMode ? 'text-zinc-500' : 'text-chrome'}>Inside</span>
                </div>
              ) : null}

              {/* Edge Heartbeat Pill */}
              {activeBranch ? (
                <div
                  className={`flex min-h-[44px] items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-bold ${
                    activeBranch.edgeNodeOnline
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500'
                      : 'border-amber-500/50 bg-amber-500/15 text-amber-500'
                  }`}
                >
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      activeBranch.edgeNodeOnline ? 'animate-pulse bg-emerald-500' : 'bg-amber-500'
                    }`}
                  />
                  <Activity className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{activeBranch.edgeNodeOnline ? 'Edge Online' : 'Edge Offline'}</span>
                </div>
              ) : null}

              {headerActions}

              {/* Light/Dark Mode Toggle */}
              <button
                type="button"
                onClick={onToggleLightMode}
                aria-label={lightMode ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
                className={`flex h-12 w-12 items-center justify-center rounded-xl border transition-colors ${
                  lightMode
                    ? 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
                    : 'border-steel bg-obsidian text-chrome hover:text-chalk'
                }`}
              >
                {lightMode ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
