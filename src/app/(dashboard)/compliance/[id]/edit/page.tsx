import { notFound } from 'next/navigation';
import { updateRequirement } from '@/actions/compliance/requirements';
import { RequirementForm } from '@/components/compliance/requirement-form';
import { can } from '@/lib/auth/rbac';
import { getActiveSite, requireModule } from '@/lib/auth/session';
import { getRequirement, getSiteUsers } from '@/lib/data/compliance';
import { toDateInput } from '@/lib/utils';

export default async function EditRequirementPage({ params }: { params: { id: string } }) {
  const user = await requireModule('compliance');
  const site = await getActiveSite(user);
  if (!site || !can(user.role, 'requirement:write')) notFound();
  const r = await getRequirement(params.id, site.id);
  if (!r) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-display text-3xl font-semibold">Edit requirement</h1>
      <RequirementForm
        action={updateRequirement.bind(null, r.id)}
        owners={await getSiteUsers(site.id)}
        submitLabel="Save changes"
        cancelHref={`/compliance/${r.id}`}
        defaults={{
          title: r.title, citation: r.citation, authority: r.authority, jurisdiction: r.jurisdiction,
          category: r.category, obligation: r.obligation, description: r.description ?? '',
          sourceUrl: r.sourceUrl ?? '', ownerId: r.ownerId ?? '',
          effectiveDate: toDateInput(r.effectiveDate),
          reviewFrequencyDays: r.reviewFrequencyDays?.toString() ?? '',
          nextReviewDate: toDateInput(r.nextReviewDate),
        }}
      />
    </div>
  );
}
