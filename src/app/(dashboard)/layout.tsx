import { AlertTriangle, ClipboardCheck, ClipboardList, Recycle, Scale } from 'lucide-react';
import { NavLink } from '@/components/nav-link';
import { getActiveSite, requireUser } from '@/lib/auth/session';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const site = await getActiveSite(user);

  return (
    <div className="flex min-h-screen flex-col lg:flex-row print:block">
      <aside className="border-b border-line lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r print:hidden">
        <div className="p-4">
          <p className="font-display text-xl font-semibold">SafetyComply AI</p>
          <p className="mt-1 text-xs text-steel">{site ? site.name : 'No site assigned'}</p>
        </div>
        <nav aria-label="Modules" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col">
          <NavLink href="/compliance"><Scale size={16} aria-hidden /> Compliance</NavLink>
          <NavLink href="/incidents"><AlertTriangle size={16} aria-hidden /> Incidents and CAPA</NavLink>
          <NavLink href="/waste"><Recycle size={16} aria-hidden /> Waste and discharge</NavLink>
          <NavLink href="/risk"><ClipboardCheck size={16} aria-hidden /> Risk assessment</NavLink>
          <NavLink href="/audits"><ClipboardList size={16} aria-hidden /> Audits and inspections</NavLink>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 p-4 sm:p-8 print:p-0">{children}</main>
    </div>
  );
}
