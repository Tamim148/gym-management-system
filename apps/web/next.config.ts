import type { NextConfig } from 'next';

function buildConnectSrc(): string {
  const sources = new Set<string>([
    "'self'",
    'http://localhost:4000',
    'http://127.0.0.1:4000',
    'ws://localhost:4000',
    'ws://127.0.0.1:4000',
  ]);

  const rawApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (rawApiUrl) {
    try {
      const parsed = new URL(rawApiUrl);
      sources.add(parsed.origin);
      if (parsed.protocol === 'https:') {
        sources.add(`wss://${parsed.host}`);
      } else if (parsed.protocol === 'http:') {
        sources.add(`ws://${parsed.host}`);
      }
    } catch {
      // Ignore malformed NEXT_PUBLIC_API_URL to avoid injecting invalid CSP directives
    }
  }

  return Array.from(sources).join(' ');
}

function buildContentSecurityPolicy(): string {
  const isDev = process.env.NODE_ENV !== 'production';
  const scriptSrc = isDev
    ? "'self' 'unsafe-inline' 'unsafe-eval'"
    : "'self' 'unsafe-inline'";

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob:",
    `connect-src ${buildConnectSrc()}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

const nextConfig: NextConfig = {
  transpilePackages: ['@vintage/shared'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: buildContentSecurityPolicy(),
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=(), payment=()',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
