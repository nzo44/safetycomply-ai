import type { Role } from '@prisma/client';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { ToastProvider } from '@/components/ui/toast';
import { hasModule } from '@/lib/auth/modules';
import { getAccessibleSites, getActiveSite, requireUser } from '@/lib/auth/session';
import { getNavCounts } from '@/lib/data/dashboard';

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Administrator', HSE_MANAGER: 'HSE Manager', INSPECTOR: 'Inspector', AUDITOR: 'Auditor',
};

/** "DZ" -> "Algeria". Falls back to null for unknown codes so the badge degrades to "Ops Hub". */
function regionName(code: string | null | undefined) {
  if (!code) return null;
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase()) ?? null;
  } catch {
    return null;
  }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const site = await getActiveSite(user);
  const [counts, sites] = await Promise.all([
    site && hasModule(user, 'incidents') ? getNavCounts(site.id, user) : Promise.resolve({ incidentsPending: 0 }),
    getAccessibleSites(user),
  ]);
  const region = regionName(site?.country);

  return (
    <ToastProvider>
      <div className="flex min-h-screen flex-col bg-canvas lg:h-screen lg:flex-row lg:overflow-hidden print:block print:h-auto">
        <AppSidebar
          context={region ? `${region} Ops Hub` : 'Ops Hub'}
          siteName={site?.name ?? null}
          siteCode={site?.code ?? null}
          userName={user.fullName}
          roleLabel={ROLE_LABEL[user.role]}
          pendingIncidents={counts.incidentsPending}
          allowedModules={user.role === 'ADMIN' ? null : user.allowedModules}
          isAdmin={user.role === 'ADMIN'}
          sites={sites}
          activeSiteId={site?.id ?? null}
        />
        <main className="min-w-0 flex-1 lg:overflow-y-auto print:overflow-visible">
          <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8 print:max-w-none print:p-0">{children}</div>
        </main>
      </div>
    </ToastProvider>
  );
}
