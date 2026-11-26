import type { Metadata, Viewport } from 'next';
import {
  Barlow_Condensed,
  Noto_Sans_Bengali,
  Plus_Jakarta_Sans,
} from 'next/font/google';
import './globals.css';

const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-barlow-condensed',
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plus-jakarta',
});

const notoBengali = Noto_Sans_Bengali({
  subsets: ['bengali'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-bengali',
});

export const metadata: Metadata = {
  title: 'Vintage Aesthetics Gym | Multi-Branch Ecosystem',
  description:
    'Modern Golden Era Iron management ecosystem across Gulshan-1, Dhanmondi, and Uttara.',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#7F1118',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${barlowCondensed.variable} ${plusJakarta.variable} ${notoBengali.variable}`}
    >
      <body className="min-h-screen bg-obsidian text-chalk antialiased">
        {children}
      </body>
    </html>
  );
}
