'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AlertTriangle, ClipboardCheck, ClipboardList, LayoutDashboard, LogOut, Menu, Recycle, Scale, ShieldCheck, X,
  type LucideIcon,
} from 'lucide-react';
import { signOut } from '@/actions/auth/session';
import { SiteSwitcher, type SiteOption } from './SiteSwitcher';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Match only this exact path (used by the overview, which is the prefix of every route). */
  exact?: boolean;
  badge?: 'incidentsPending';
}

const NAV: NavItem[] = [
  { href: '/', label: 'Executive Overview', icon: LayoutDashboard, exact: true },
  { href: '/compliance', label: 'Legal Compliance Matrix', icon: Scale },
  { href: '/incidents', label: 'Incidents & CAPA', icon: AlertTriangle, badge: 'incidentsPending' },
  { href: '/waste', label: 'Industrial Waste Engine', icon: Recycle },
  { href: '/risk', label: 'Risk Assessment & HIRA', icon: ClipboardCheck },
  { href: '/audits', label: 'Audits & Field Inspections', icon: ClipboardList },
];

export interface AppSidebarProps {
  /** Context badge under the title, for example "Algeria Ops Hub". */
  context: string;
  siteName: string | null;
  siteCode: string | null;
  userName: string;
  roleLabel: string;
  pendingIncidents: number;
  sites: SiteOption[];
  activeSiteId: string | null;
}

function Brand({ context }: { context: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/30">
        <ShieldCheck size={20} aria-hidden className="text-emerald-400" />
      </span>
      <div className="min-w-0">
        <p className="font-display text-lg font-semibold leading-tight text-white">SafetyComply AI</p>
        <span className="mt-0.5 inline-block rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
          {context}
        </span>
      </div>
    </div>
  );
}

function SidebarBody({
  props, pathname, onNavigate,
}: { props: AppSidebarProps; pathname: string; onNavigate?: () => void }) {
  const counts = { incidentsPending: props.pendingIncidents };

  return (
    <div className="flex h-full flex-col">
      <div className="hidden px-5 py-5 lg:block"><Brand context={props.context} /></div>

      <nav aria-label="Primary" className="flex-1 overflow-y-auto px-3 py-3">
        <ul className="space-y-1">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            const n = item.badge ? counts[item.badge] : 0;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={`group flex items-center gap-3 rounded-md border-l-2 px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
                    active
                      ? 'border-emerald-400 bg-slate-800 text-white'
                      : 'border-transparent text-slate-400 hover:bg-slate-800/60 hover:text-slate-100'
                  }`}
                >
                  <Icon size={17} aria-hidden className={active ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-300'} />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {n > 0 && (
                    <span
                      aria-label={`${n} pending item${n === 1 ? '' : 's'}`}
                      className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300 ring-1 ring-amber-500/30"
                    >
                      {n} Pending
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="space-y-3 border-t border-slate-800 px-5 py-4 text-xs">
        <div>
          <p className="truncate font-medium text-slate-200">{props.userName}</p>
          <p className="mt-0.5 text-slate-500">{props.roleLabel}</p>
        </div>
        {props.sites.length > 1 ? (
          <SiteSwitcher sites={props.sites} activeId={props.activeSiteId} />
        ) : props.siteName ? (
          <p className="truncate text-slate-400">
            {props.siteName}{props.siteCode ? ` (${props.siteCode})` : ''}
          </p>
        ) : null}
        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
          >
            <LogOut size={14} aria-hidden /> Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

export function AppSidebar(props: AppSidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile drawer after navigating, and on Escape.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      {/* Desktop: persistent sidebar */}
      <aside className="hidden border-r border-slate-800 bg-slate-900 lg:flex lg:w-64 lg:shrink-0 lg:flex-col print:hidden">
        <SidebarBody props={props} pathname={pathname} />
      </aside>

      {/* Mobile and tablet: top bar with an off-canvas drawer */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3 lg:hidden print:hidden">
        <Brand context={props.context} />
        <button
          type="button"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          onClick={() => setOpen((o) => !o)}
          className="rounded-md p-2 text-slate-300 hover:bg-slate-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
        >
          {open ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden print:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-slate-950/70"
          />
          <aside
            id="mobile-nav"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-slate-800 bg-slate-900 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <Brand context={props.context} />
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setOpen(false)}
                className="rounded-md p-2 text-slate-300 hover:bg-slate-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
              >
                <X size={20} aria-hidden />
              </button>
            </div>
            <SidebarBody props={props} pathname={pathname} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
