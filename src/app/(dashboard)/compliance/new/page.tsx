import { notFound } from 'next/navigation';
import { createRequirement } from '@/actions/compliance/requirements';
import { RequirementForm } from '@/components/compliance/requirement-form';
import { can } from '@/lib/auth/rbac';
import { getActiveSite, requireModule } from '@/lib/auth/session';
import { getSiteUsers } from '@/lib/data/compliance';

export default async function NewRequirementPage() {
  const user = await requireModule('compliance');
  const site = await getActiveSite(user);
  if (!site || !can(user.role, 'requirement:write')) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-display text-3xl font-semibold">Add requirement</h1>
      <RequirementForm
        action={createRequirement}
        owners={await getSiteUsers(site.id)}
        submitLabel="Add requirement"
        cancelHref="/compliance"
      />
    </div>
  );
}
