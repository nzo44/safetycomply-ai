import { notFound } from 'next/navigation';
import { IncidentForm } from '@/components/incidents/incident-form';
import { can } from '@/lib/auth/rbac';
import { getActiveSite, requireUser } from '@/lib/auth/session';
import { toZonedLocalInput } from '@/lib/utils';

export default async function NewIncidentPage() {
  const user = await requireUser();
  const site = await getActiveSite(user);
  if (!site || !can(user.role, 'incident:report')) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-display text-3xl font-semibold">Report incident</h1>
      <IncidentForm nowLocal={toZonedLocalInput(new Date(), site.timezone)} />
    </div>
  );
}
