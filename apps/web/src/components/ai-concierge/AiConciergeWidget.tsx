'use client';

import {
  ALLOWED_AI_NAV_ROUTES,
  AiChatResponse,
  AiDomAction,
  AllowedAiNavRoute,
} from '@vintage/shared';
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Send,
  ShieldAlert,
  X,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useRef, useState } from 'react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  provider?: 'gemini' | 'mock';
  intentType?: string;
  citations?: string[];
  action?: AiDomAction;
  confirmed?: boolean;
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:4000';

const QUICK_PROMPTS = [
  'What are the membership prices?',
  'When are Off-Peak hours?',
  'Freeze my plan for 7 days',
  'Book me a HIIT class',
];

function isAllowedNavRoute(route: unknown): route is AllowedAiNavRoute {
  return (
    typeof route === 'string' &&
    (ALLOWED_AI_NAV_ROUTES as readonly string[]).includes(route)
  );
}

export function AiConciergeWidget() {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      sender: 'assistant',
      text: 'Welcome to Vintage Aesthetics Gym Concierge. Ask about BDT plans, Off-Peak 1 PM–3 PM deals, freezing your plan, or booking a class.',
      provider: 'mock',
      citations: ['Vintage Aesthetics Gym Policy'],
    },
  ]);

  const listEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  async function sendPrompt(promptText: string) {
    const trimmed = promptText.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          prompt: trimmed.slice(0, 500),
          currentRoute: pathname || '/',
        }),
      });

      if (!res.ok) {
        const errBody = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(
          errBody?.message || `AI Concierge returned status ${res.status}`,
        );
      }

      const data = (await res.json()) as AiChatResponse;
      const assistantMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        text: data.reply,
        provider: data.provider,
        intentType: data.intentType,
        citations: data.citations,
        action: data.action,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (
        data.action?.type === 'NAVIGATE' &&
        isAllowedNavRoute(data.action.route)
      ) {
        router.push(data.action.route);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Unable to reach AI Concierge right now.';
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          text: errorMessage,
          intentType: 'ERROR',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmWrite(messageId: string, action: AiDomAction) {
    if (!action.actionType || confirmingId) return;
    setConfirmingId(messageId);

    try {
      const res = await fetch(`${API_BASE}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          prompt: `Confirm ${action.actionType}`,
          currentRoute: pathname || '/',
          confirmAction: {
            actionType: action.actionType,
            targetId: action.targetId,
            days: action.days,
          },
        }),
      });

      if (res.status === 401) {
        setMessages((prev) => [
          ...prev,
          {
            id: `auth-${Date.now()}`,
            sender: 'assistant',
            text: 'Please sign in to your member account before confirming class bookings or plan freezes.',
            intentType: 'AUTH_REQUIRED',
          },
        ]);
        return;
      }

      if (!res.ok) {
        const errBody = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(errBody?.message || `Action failed (${res.status})`);
      }

      const data = (await res.json()) as AiChatResponse;
      setMessages((prev) =>
        prev
          .map((m) => (m.id === messageId ? { ...m, confirmed: true } : m))
          .concat({
            id: `confirm-${Date.now()}`,
            sender: 'assistant',
            text: data.reply,
            provider: data.provider,
            intentType: data.intentType,
            citations: data.citations,
            action: data.action,
          }),
      );

      if (
        data.action?.type === 'NAVIGATE' &&
        isAllowedNavRoute(data.action.route)
      ) {
        router.push(data.action.route);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `confirm-err-${Date.now()}`,
          sender: 'assistant',
          text:
            err instanceof Error
              ? err.message
              : 'Could not complete confirmed action.',
          intentType: 'ERROR',
        },
      ]);
    } finally {
      setConfirmingId(null);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendPrompt(input);
  }

  const isMemberRoute = pathname?.startsWith('/member');
  const positionClass = isMemberRoute
    ? 'bottom-24 right-4 md:bottom-6 md:right-6'
    : 'bottom-4 right-4 md:bottom-6 md:right-6';

  return (
    <div className={`fixed z-40 flex flex-col items-end gap-3 ${positionClass}`}>
      {isOpen && (
        <section
          role="dialog"
          aria-label="Vintage Aesthetics AI Concierge"
          data-testid="ai-concierge-drawer"
          className="flex h-[500px] w-[min(92vw,384px)] flex-col overflow-hidden rounded-2xl border border-steel bg-iron shadow-2xl"
        >
          {/* Header */}
          <header className="border-b border-steel bg-oxblood-deep">
            <div className="va-led-rule w-full" />
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-silver/25 bg-obsidian text-crimson">
                  <Bot className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold uppercase tracking-wide text-chalk">
                    Iron Concierge
                  </h2>
                  <p className="text-[11px] text-silver">
                    Policy &amp; 1-Tap Booking Assistant
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close AI Concierge"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-steel bg-obsidian text-chrome transition hover:text-chalk"
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>
          </header>

          {/* Quick Chips */}
          <div className="flex gap-1.5 overflow-x-auto border-b border-steel bg-obsidian px-3 py-2">
            {QUICK_PROMPTS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => void sendPrompt(q)}
                disabled={loading}
                className="shrink-0 rounded-full border border-steel bg-iron px-2.5 py-1 text-[11px] text-silver transition hover:border-crimson hover:text-chalk disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Messages (Strict Plain Text Rendering) */}
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              const isSecurityRefusal = msg.intentType === 'SECURITY_REFUSAL';

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      isUser
                        ? 'bg-crimson text-chalk'
                        : isSecurityRefusal
                          ? 'border border-access-denied/60 bg-access-denied/10 text-chalk'
                          : 'border border-steel bg-obsidian text-silver'
                    }`}
                  >
                    {isSecurityRefusal && (
                      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-access-denied">
                        <ShieldAlert className="h-3.5 w-3.5" strokeWidth={1.75} />
                        Security Policy Guard
                      </div>
                    )}
                    <p className="whitespace-pre-wrap break-words">{msg.text}</p>

                    {!isUser && msg.citations && msg.citations.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {msg.citations.map((cite) => (
                          <span
                            key={cite}
                            className="rounded border border-steel bg-iron px-1.5 py-0.5 text-[10px] text-chrome"
                          >
                            {cite}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Safe Navigation Action */}
                    {msg.action?.type === 'NAVIGATE' &&
                      isAllowedNavRoute(msg.action.route) && (
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              msg.action?.route &&
                              isAllowedNavRoute(msg.action.route)
                            ) {
                              router.push(msg.action.route);
                            }
                          }}
                          className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-oxblood bg-oxblood/30 px-3 py-1.5 text-xs font-semibold text-chalk transition hover:bg-oxblood/60"
                        >
                          <span>{msg.action.label}</span>
                          <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                        </button>
                      )}

                    {/* 1-Tap Confirmation Card for Write Intents */}
                    {msg.action?.type === 'CONFIRM_WRITE' && (
                      <div className="mt-2.5 rounded-lg border border-access-warn/50 bg-access-warn/10 p-2.5">
                        <p className="text-[11px] font-semibold text-access-warn">
                          1-Tap Action Confirmation
                        </p>
                        <p className="mt-0.5 text-xs text-chalk">
                          {msg.action.label}
                        </p>
                        {msg.confirmed ? (
                          <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-access-ok">
                            <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                            Confirmed &amp; Executed
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={confirmingId === msg.id}
                            onClick={() =>
                              msg.action &&
                              void handleConfirmWrite(msg.id, msg.action)
                            }
                            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-crimson px-3 py-2 text-xs font-bold uppercase tracking-wide text-chalk transition hover:bg-crimson-hover disabled:opacity-60"
                          >
                            {confirmingId === msg.id ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
                                Confirming...
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                                Confirm &amp; Execute
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-chrome">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-crimson" strokeWidth={1.75} />
                <span>Consulting gym policy &amp; live schedule...</span>
              </div>
            )}
            <div ref={listEndRef} />
          </div>

          {/* Input Bar */}
          <form
            onSubmit={handleSubmit}
            className="border-t border-steel bg-obsidian p-3"
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={500}
                placeholder="Ask pricing, off-peak, freeze, or book..."
                aria-label="AI Concierge prompt"
                className="min-h-[42px] flex-1 rounded-xl border border-steel bg-iron px-3 text-sm text-chalk placeholder:text-chrome/70 focus:border-crimson focus:outline-none"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                aria-label="Send message"
                className="flex h-[42px] w-[42px] items-center justify-center rounded-xl bg-crimson text-chalk transition hover:bg-crimson-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] text-chrome">
              <span>Gemini / Local Mock Concierge</span>
              <span>{input.length}/500</span>
            </div>
          </form>
        </section>
      )}

      {/* Floating Concierge Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        data-testid="ai-concierge-orb"
        aria-label={isOpen ? 'Close AI Concierge' : 'Open AI Concierge'}
        className="flex h-12 w-12 items-center justify-center rounded-full border border-crimson bg-oxblood text-chalk shadow-xl transition-colors hover:bg-crimson md:h-14 md:w-14"
      >
        {isOpen ? (
          <X className="h-5 w-5 md:h-6 md:w-6" strokeWidth={1.75} />
        ) : (
          <MessageSquare className="h-5 w-5 md:h-6 md:w-6" strokeWidth={1.75} />
        )}
      </button>
    </div>
  );
}
