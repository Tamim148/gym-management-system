'use client';

import {
  NotificationChannel,
  NotificationItem,
  NotificationTriggerType,
} from '@vintage/shared';
import {
  Bell,
  Check,
  Copy,
  Inbox,
  Mail,
  RefreshCw,
  Search,
  Send,
  Smartphone,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BrandCrest } from '@/components/ui/BrandCrest';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:4000';

const CHANNELS = ['ALL', ...Object.values(NotificationChannel)] as const;
const TRIGGERS = ['ALL', ...Object.values(NotificationTriggerType)] as const;

function channelIcon(channel: string) {
  switch (channel) {
    case NotificationChannel.TELEGRAM:
      return Send;
    case NotificationChannel.WEB_PUSH:
      return Smartphone;
    case NotificationChannel.EMAIL_RESEND:
      return Mail;
    case NotificationChannel.IN_APP:
      return Bell;
    default:
      return Inbox;
  }
}

export default function DevInboxPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [channelFilter, setChannelFilter] = useState<string>('ALL');
  const [triggerFilter, setTriggerFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadInbox = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/notifications/dev-inbox`, {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error(`Dev Inbox API returned HTTP ${res.status}`);
      }
      const data = (await res.json()) as NotificationItem[];
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? `${err.message} — Start the NestJS API or run a checkout/OTP trigger to populate messages.`
          : 'Unable to connect to Dev Inbox API.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (channelFilter !== 'ALL' && item.channel !== channelFilter) {
        return false;
      }
      if (triggerFilter !== 'ALL' && item.triggerType !== triggerFilter) {
        return false;
      }
      if (!q) return true;
      return (
        item.payload.toLowerCase().includes(q) ||
        (item.subject || '').toLowerCase().includes(q) ||
        (item.userName || '').toLowerCase().includes(q) ||
        item.triggerType.toLowerCase().includes(q)
      );
    });
  }, [items, channelFilter, triggerFilter, searchQuery]);

  async function copyOtp(item: NotificationItem) {
    const match = item.payload.match(/\b(\d{6})\b/);
    if (!match) return;
    await navigator.clipboard.writeText(match[1]);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 1800);
  }

  return (
    <main className="min-h-screen bg-obsidian px-4 pt-6 pb-24 text-chalk md:px-8 md:py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <header className="overflow-hidden rounded-2xl border border-steel bg-iron">
          <div className="va-led-rule w-full" />
          <div className="flex flex-col justify-between gap-4 p-5 md:flex-row md:items-center">
            <div className="flex items-center gap-3.5">
              <Link href="/" aria-label="Back to Storefront">
                <BrandCrest size={50} />
              </Link>
              <div>
                <p className="text-xs font-medium text-chrome">
                  Local Notification Dispatch Viewer
                </p>
                <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight text-chalk md:text-4xl">
                  Free Dev Notification Inbox
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => void loadInbox()}
                disabled={loading}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-crimson px-4 text-xs font-bold uppercase tracking-wider text-chalk transition hover:bg-crimson-hover disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
                  strokeWidth={1.75}
                />
                Refresh Inbox
              </button>
              <Link
                href="/simulator"
                className="inline-flex min-h-[42px] items-center rounded-xl border border-steel bg-obsidian px-4 text-xs font-semibold uppercase tracking-wider text-silver transition hover:border-crimson hover:text-chalk"
              >
                Hardware Simulator
              </Link>
            </div>
          </div>
        </header>

        {/* Filters */}
        <section className="va-card grid gap-3 rounded-2xl p-4 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-chrome"
              strokeWidth={1.75}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search OTPs, receipts, members..."
              aria-label="Search notifications"
              className="min-h-11 w-full rounded-xl border border-steel bg-obsidian pl-9 pr-3 text-sm text-chalk placeholder:text-chrome/60 focus:border-crimson focus:outline-none"
            />
          </div>

          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            aria-label="Filter by channel"
            className="min-h-11 rounded-xl border border-steel bg-obsidian px-3 text-sm text-chalk focus:border-crimson focus:outline-none"
          >
            {CHANNELS.map((ch) => (
              <option key={ch} value={ch}>
                Channel: {ch}
              </option>
            ))}
          </select>

          <select
            value={triggerFilter}
            onChange={(e) => setTriggerFilter(e.target.value)}
            aria-label="Filter by trigger type"
            className="min-h-11 rounded-xl border border-steel bg-obsidian px-3 text-sm text-chalk focus:border-crimson focus:outline-none"
          >
            {TRIGGERS.map((tr) => (
              <option key={tr} value={tr}>
                Trigger: {tr}
              </option>
            ))}
          </select>
        </section>

        {errorMsg && (
          <div className="rounded-xl border border-access-warn/50 bg-access-warn/10 px-4 py-3 text-sm text-access-warn">
            {errorMsg}
          </div>
        )}

        {/* Messages Feed */}
        <section className="space-y-3" data-testid="dev-inbox-list">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="va-card h-24 animate-pulse rounded-xl bg-iron"
                />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="va-card rounded-2xl p-10 text-center">
              <Inbox className="mx-auto h-10 w-10 text-chrome" strokeWidth={1.75} />
              <h2 className="font-display mt-3 text-2xl font-bold uppercase text-chalk">
                No Simulated Dispatches Yet
              </h2>
              <p className="mt-1 text-sm text-chrome">
                OTPs, mock bKash/Nagad receipts, expiry reminders (T-7d/3d/1d),
                waitlist promotions, and Telegram/Web Push payloads appear here
                automatically.
              </p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const Icon = channelIcon(item.channel);
              const otpMatch = item.payload.match(/\b(\d{6})\b/);

              return (
                <article
                  key={item.id}
                  className="va-card rounded-xl p-4 transition hover:border-oxblood"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-steel bg-obsidian text-crimson">
                        <Icon className="h-5 w-5" strokeWidth={1.75} />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded bg-oxblood px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-chalk">
                            {item.channel}
                          </span>
                          <span className="rounded border border-steel bg-obsidian px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-access-warn">
                            {item.triggerType}
                          </span>
                          <span className="text-xs text-chrome">
                            {item.userName || item.userId}
                          </span>
                        </div>
                        <h3 className="mt-1 text-sm font-bold text-chalk">
                          {item.subject || `${item.triggerType} Dispatch`}
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {otpMatch && (
                        <button
                          type="button"
                          onClick={() => void copyOtp(item)}
                          className="inline-flex items-center gap-1 rounded-lg border border-access-ok/40 bg-access-ok/10 px-2.5 py-1 text-xs font-semibold text-access-ok"
                        >
                          {copiedId === item.id ? (
                            <>
                              <Check className="h-3.5 w-3.5" strokeWidth={1.75} />
                              Copied {otpMatch[1]}
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
                              Copy OTP ({otpMatch[1]})
                            </>
                          )}
                        </button>
                      )}
                      <time className="font-mono text-xs text-chrome tabular-nums">
                        {new Date(item.sentAt).toLocaleString()}
                      </time>
                    </div>
                  </div>

                  <p className="mt-3 whitespace-pre-wrap break-words rounded-lg border border-steel bg-obsidian p-3 text-sm text-silver">
                    {item.payload}
                  </p>
                </article>
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}
