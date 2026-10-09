import type { Metadata } from 'next';
import { Barlow, Public_Sans } from 'next/font/google';
import './globals.css';

const display = Barlow({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-display' });
const body = Public_Sans({ subsets: ['latin'], variable: '--font-body' });

export const metadata: Metadata = { title: 'SafetyComply AI', description: 'Industrial HSE compliance platform' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen bg-canvas font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
