import Link from 'next/link';
import { ArrowUpRight, type LucideIcon } from 'lucide-react';

export type Tone = 'neutral' | 'ok' | 'warn' | 'crit';

const TONE: Record<Tone, string> = {
  neutral: 'text-slate-100', ok: 'text-emerald-400', warn: 'text-amber-400', crit: 'text-rose-400',
};

export function Stat({ label, value, tone = 'neutral', hint }: { label: string; value: React.ReactNode; tone?: Tone; hint?: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className={`font-display text-3xl font-semibold tabular-nums ${TONE[tone]}`}>{value}</dd>
      {hint && <dd className="text-xs text-slate-500">{hint}</dd>}
    </div>
  );
}

export function StatLine({ label, value, tone = 'neutral' }: { label: string; value: React.ReactNode; tone?: Tone }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <dt className="text-slate-400">{label}</dt>
      <dd className={`font-semibold tabular-nums ${TONE[tone]}`}>{value}</dd>
    </div>
  );
}

export interface KpiCardProps {
  title: string;
  href: string;
  icon: LucideIcon;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function KpiCard({ title, href, icon: Icon, children, footer }: KpiCardProps) {
  return (
    <section aria-label={title} className="flex flex-col rounded-xl border border-slate-800 bg-slate-900 p-5">
      <header className="flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-medium text-slate-300">
          <Icon size={16} aria-hidden className="text-slate-500" />
          {title}
        </h2>
        <Link
          href={href}
          className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
        >
          <ArrowUpRight size={16} aria-hidden />
          <span className="sr-only">Open {title}</span>
        </Link>
      </header>
      <div className="mt-4 flex-1">{children}</div>
      {footer && <footer className="mt-4 border-t border-slate-800 pt-3 text-xs text-slate-400">{footer}</footer>}
    </section>
  );
}
