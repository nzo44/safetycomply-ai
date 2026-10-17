import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { recordAudit } from '@/actions/compliance/audits';
import { archiveRequirement } from '@/actions/compliance/requirements';
import { AuditForm } from '@/components/compliance/audit-form';
import { EvidenceLinks } from '@/components/compliance/chips';
import { StatusBadge } from '@/components/compliance/status-badge';
import { can } from '@/lib/auth/rbac';
import { getActiveSite, requireModule } from '@/lib/auth/session';
import { CATEGORY_LABEL, PRIORITY_LABEL } from '@/lib/compliance-meta';
import { getRequirement } from '@/lib/data/compliance';
import { fmtDate } from '@/lib/utils';

export default async function RequirementPage({ params }: { params: { id: string } }) {
  const user = await requireModule('compliance');
  const site = await getActiveSite(user);
  if (!site) notFound();
  const r = await getRequirement(params.id, site.id);
  if (!r || !r.isActive) notFound();

  const canEdit = can(user.role, 'requirement:write');
  const canAudit = can(user.role, 'audit:write');
  const overdue = r.nextReviewDate && r.nextReviewDate < new Date();

  const meta: [string, React.ReactNode][] = [
    ['Category', CATEGORY_LABEL[r.category]],
    ['Authority', r.authority],
    ['Jurisdiction', r.jurisdiction],
    ['Owner', r.owner?.fullName ?? 'Unassigned'],
    ['Effective', fmtDate(r.effectiveDate)],
    ['Review cycle', r.reviewFrequencyDays ? `Every ${r.reviewFrequencyDays} days` : '—'],
    ['Next review', <span key="n" className={overdue ? 'font-medium text-noncompliant' : ''}>{fmtDate(r.nextReviewDate)}{overdue && ' (overdue)'}</span>],
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link href="/compliance" className="text-sm text-steel underline">Back to matrix</Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-semibold">{r.title}</h1>
          <p className="mt-1 text-sm text-steel">{r.citation}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={r.currentStatus} />
          {canEdit && (
            <>
              <Link href={`/compliance/${r.id}/edit`} className="inline-flex items-center gap-1.5 rounded border border-line bg-white px-3 py-1.5 text-sm font-medium hover:bg-canvas">
                <Pencil size={14} aria-hidden /> Edit
              </Link>
              <form action={archiveRequirement.bind(null, r.id)}>
                <button className="rounded border border-line bg-white px-3 py-1.5 text-sm font-medium text-noncompliant hover:bg-canvas">Archive</button>
              </form>
            </>
          )}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-8">
          <section aria-labelledby="obligation" className="rounded border border-line bg-white p-5">
            <h2 id="obligation" className="font-display text-xl font-semibold">Obligation</h2>
            <p className="mt-2 max-w-prose whitespace-pre-line text-sm leading-relaxed">{r.obligation}</p>
            {r.description && <p className="mt-4 max-w-prose whitespace-pre-line text-sm text-steel">{r.description}</p>}
            {r.sourceUrl && (
              <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm text-plant underline">View source text</a>
            )}
          </section>

          {canAudit && (
            <section aria-labelledby="record">
              <h2 id="record" className="mb-3 font-display text-xl font-semibold">Record an audit</h2>
              <div className="rounded border border-line bg-white px-5 pt-5">
                <AuditForm requirementId={r.id} action={recordAudit} />
              </div>
            </section>
          )}

          <section aria-labelledby="history">
            <h2 id="history" className="mb-3 font-display text-xl font-semibold">Audit history</h2>
            {r.audits.length === 0 ? (
              <p className="rounded border border-line bg-white p-5 text-sm text-steel">
                No audits recorded yet.{canAudit ? ' Record the first one above.' : ''}
              </p>
            ) : (
              <ol className="space-y-3">
                {r.audits.map((a) => (
                  <li key={a.id} className="rounded border border-line bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">{fmtDate(a.auditDate)} <span className="font-normal text-steel">by {a.auditor.fullName}</span></p>
                      <StatusBadge status={a.status} />
                    </div>
                    {a.findings && <p className="mt-2 whitespace-pre-line text-sm">{a.findings}</p>}
                    {a.gapDescription && (
                      <p className="mt-2 border-l-2 border-partial pl-3 text-sm">
                        <span className="font-medium">{a.gapSeverity ? `${PRIORITY_LABEL[a.gapSeverity]} gap: ` : 'Gap: '}</span>
                        {a.gapDescription}
                      </p>
                    )}
                    {a.evidenceUrls.length > 0 && <div className="mt-2"><EvidenceLinks urls={a.evidenceUrls} max={4} /></div>}
                    {a.capaActions.length > 0 && (
                      <p className="mt-2 text-xs text-steel">
                        Corrective actions: {a.capaActions.map((c) => `${c.referenceNo} (due ${fmtDate(c.dueDate)})`).join(', ')}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside aria-label="Requirement details">
          <dl className="space-y-3 rounded border border-line bg-white p-5 text-sm">
            {meta.map(([k, v]) => (
              <div key={k}>
                <dt className="text-steel">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </div>
  );
}
