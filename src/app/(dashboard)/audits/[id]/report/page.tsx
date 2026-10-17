import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PrintButton } from '@/components/risk/PrintButton';
import { can } from '@/lib/auth/rbac';
import { getActiveSite, requireModule } from '@/lib/auth/session';
import {
  INSPECTION_STATUS_LABEL, NCR_SEVERITY_LABEL, NCR_STATUS_LABEL, RESULT_LABEL, STANDARD_LABEL,
} from '@/lib/audits/meta';
import { computeScore } from '@/lib/audits/score';
import { getInspectionDetail } from '@/lib/data/audits';
import { evidenceLabel } from '@/lib/evidence';
import { fmtDate, fmtDayInZone } from '@/lib/utils';

/** Printable inspection report. Use the browser's "Save as PDF" from the print dialog. */
export default async function InspectionReportPage({ params }: { params: { id: string } }) {
  const user = await requireModule('audits');
  if (!can(user.role, 'inspection:read')) notFound();
  const site = await getActiveSite(user);
  if (!site) notFound();
  const a = await getInspectionDetail(params.id, site.id);
  if (!a) notFound();

  const items = a.categories.flatMap((c) => c.items);
  const s = computeScore(items.map((i) => ({ weight: i.weight, result: i.result })));
  const unanswered = items.length - s.answered;
  const completed = a.status === 'COMPLETED';

  return (
    <div className="mx-auto max-w-[1000px] space-y-6 print:max-w-none print:space-y-4">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link href={`/audits/${a.id}`} className="text-sm text-steel underline">Back to inspection</Link>
        <PrintButton />
      </div>

      {!completed && (
        <p role="note" className="border-2 border-ink px-3 py-2 text-center text-sm font-bold">
          {INSPECTION_STATUS_LABEL[a.status].toUpperCase()}: THIS INSPECTION IS NOT COMPLETED. RESULTS ARE PRELIMINARY.
        </p>
      )}

      <header className="flex items-start justify-between gap-6 border-b-2 border-ink pb-3">
        <div>
          <p className="text-sm">{site.name} ({site.code})</p>
          <h1 className="font-display text-2xl font-bold">Inspection report: {a.checklistTitle}</h1>
          <p className="text-sm">{STANDARD_LABEL[a.standard]}</p>
        </div>
        <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-sm">
          <dt className="text-steel">Reference</dt><dd className="font-semibold">{a.referenceNo}</dd>
          <dt className="text-steel">Status</dt><dd className="font-semibold">{INSPECTION_STATUS_LABEL[a.status]}</dd>
          <dt className="text-steel">Inspector</dt><dd className="font-semibold">{a.inspectorName}</dd>
          <dt className="text-steel">Scheduled</dt><dd className="font-semibold">{fmtDate(a.scheduledDate)}</dd>
          <dt className="text-steel">Completed</dt><dd className="font-semibold">{a.completedDate ? fmtDayInZone(a.completedDate, site.timezone) : '—'}</dd>
        </dl>
      </header>

      <section aria-label="Summary" className="grid grid-cols-5 gap-3 text-center print:break-inside-avoid">
        {([
          ['Score', s.pct === null ? '—' : `${s.pct}%`],
          ['Pass', s.compliant],
          ['Fail', s.nonCompliant],
          ['N/A', s.notApplicable],
          ['Not answered', unanswered],
        ] as const).map(([label, value]) => (
          <div key={label} className="rounded border border-line p-3">
            <p className="font-display text-2xl font-semibold">{value}</p>
            <p className="text-xs text-steel">{label}</p>
          </div>
        ))}
      </section>

      {a.categories.map((c) => (
        <section key={c.category} className="space-y-2">
          <h2 className="font-display text-lg font-semibold">{c.category}</h2>
          <table className="w-full table-fixed border-collapse text-left text-xs">
            <caption className="sr-only">{c.category} results</caption>
            <thead>
              <tr className="border-y-2 border-ink bg-canvas">
                <th scope="col" className="px-1.5 py-1.5">Question</th>
                <th scope="col" className="w-[9%] px-1.5 py-1.5">Result</th>
                <th scope="col" className="w-[38%] px-1.5 py-1.5">Finding and evidence</th>
                <th scope="col" className="w-[13%] px-1.5 py-1.5">NCR</th>
              </tr>
            </thead>
            <tbody>
              {c.items.map((i) => (
                <tr key={i.questionId} className="break-inside-avoid border-b border-line align-top">
                  <td className="px-1.5 py-1.5">{i.question}</td>
                  <td className="px-1.5 py-1.5 font-semibold">{i.result ? RESULT_LABEL[i.result] : 'Not answered'}</td>
                  <td className="px-1.5 py-1.5">
                    {i.findingDescription && <p className="whitespace-pre-line">{i.findingDescription}</p>}
                    {i.evidenceUrls.length > 0 && (
                      <p className="text-steel">Evidence: {i.evidenceUrls.map(evidenceLabel).join(', ')}</p>
                    )}
                  </td>
                  <td className="px-1.5 py-1.5">{i.ncr ? i.ncr.referenceNo : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      {a.ncrs.length > 0 && (
        <section className="space-y-2 print:break-inside-avoid" aria-labelledby="ncrs">
          <h2 id="ncrs" className="font-display text-lg font-semibold">Non-conformance reports</h2>
          <table className="w-full table-fixed border-collapse text-left text-xs">
            <thead>
              <tr className="border-y-2 border-ink bg-canvas">
                <th scope="col" className="w-[12%] px-1.5 py-1.5">Reference</th>
                <th scope="col" className="w-[10%] px-1.5 py-1.5">Severity</th>
                <th scope="col" className="w-[12%] px-1.5 py-1.5">Status</th>
                <th scope="col" className="px-1.5 py-1.5">Summary and containment</th>
                <th scope="col" className="w-[13%] px-1.5 py-1.5">Linked action</th>
              </tr>
            </thead>
            <tbody>
              {a.ncrs.map((n) => (
                <tr key={n.id} className="break-inside-avoid border-b border-line align-top">
                  <td className="px-1.5 py-1.5 font-semibold">{n.referenceNo}</td>
                  <td className="px-1.5 py-1.5">{NCR_SEVERITY_LABEL[n.severity]}</td>
                  <td className="px-1.5 py-1.5">{NCR_STATUS_LABEL[n.status]}</td>
                  <td className="px-1.5 py-1.5">
                    <p>{n.summary}</p>
                    {n.containmentActions && <p className="text-steel">Containment: {n.containmentActions}</p>}
                  </td>
                  <td className="px-1.5 py-1.5">{n.capaRef ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="grid grid-cols-2 gap-8 pt-4 text-sm print:break-inside-avoid" aria-label="Sign-off">
        {[
          ['Inspector', a.inspectorName],
          ['Reviewed by', ''],
        ].map(([role, name]) => (
          <div key={role}>
            <p className="font-semibold">{role}</p>
            <p className="mt-6 border-b border-ink pb-1">{name}</p>
            <p className="mt-1 text-xs text-steel">Signature</p>
            <p className="mt-3 border-b border-ink pb-1">&nbsp;</p>
            <p className="mt-1 text-xs text-steel">Date</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-line pt-2 text-[11px] text-steel">
        Printed {fmtDayInZone(new Date(), site.timezone)} by {user.fullName}. Score is the weighted share of passes among passes and fails; N/A and unanswered items are excluded.
      </footer>
    </div>
  );
}
