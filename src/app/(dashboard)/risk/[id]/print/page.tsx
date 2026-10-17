import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PrintButton } from '@/components/risk/PrintButton';
import { RiskLevelChip } from '@/components/risk/badges';
import { RiskMatrix, type RiskMatrixMarker } from '@/components/risk/RiskMatrix';
import { getActiveSite, requireModule } from '@/lib/auth/session';
import { getAssessmentDetail } from '@/lib/data/risk';
import { ASSESSMENT_STATUS_LABEL, ASSESSMENT_TYPE_LABEL, CONTROL_LABEL } from '@/lib/risk/workflow';
import { fmtDate, fmtDayInZone } from '@/lib/utils';

export default async function PrintPage({ params }: { params: { id: string } }) {
  const user = await requireModule('risk');
  const site = await getActiveSite(user);
  if (!site) notFound();
  const a = await getAssessmentDetail(params.id, site.id);
  if (!a) notFound();

  const approved = a.status === 'APPROVED';
  const jsa = a.type === 'JSA';
  const markers: RiskMatrixMarker[] = a.hazards.flatMap((h, i) => [
    { n: i + 1, likelihood: h.initialLikelihood, severity: h.initialSeverity, kind: 'initial' as const },
    ...(h.residualLikelihood && h.residualSeverity
      ? [{ n: i + 1, likelihood: h.residualLikelihood, severity: h.residualSeverity, kind: 'residual' as const }] : []),
  ]);

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 print:max-w-none print:space-y-4">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link href={`/risk/${a.id}`} className="text-sm text-steel underline">Back to assessment</Link>
        <PrintButton />
      </div>

      {!approved && (
        <p role="note" className="border-2 border-ink px-3 py-2 text-center text-sm font-bold">
          {ASSESSMENT_STATUS_LABEL[a.status].toUpperCase()}: NOT APPROVED FOR USE
        </p>
      )}

      <header className="flex items-start justify-between gap-6 border-b-2 border-ink pb-3">
        <div>
          <p className="text-sm">{site.name} ({site.code})</p>
          <h1 className="font-display text-2xl font-bold">{a.title}</h1>
          <p className="text-sm">{ASSESSMENT_TYPE_LABEL[a.type]}</p>
        </div>
        <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-sm">
          <dt className="text-steel">Reference</dt><dd className="font-semibold">{a.referenceNo}</dd>
          <dt className="text-steel">Version</dt><dd className="font-semibold">{a.version}</dd>
          <dt className="text-steel">Status</dt><dd className="font-semibold">{ASSESSMENT_STATUS_LABEL[a.status]}</dd>
          <dt className="text-steel">Next review</dt><dd className="font-semibold">{fmtDate(a.nextReviewDate)}</dd>
        </dl>
      </header>

      <section className="grid grid-cols-[1fr_440px] gap-6 print:break-inside-avoid">
        <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-steel">Activity</dt><dd>{a.activity}</dd>
          <dt className="text-steel">Area</dt><dd>{a.area ?? '—'}</dd>
          <dt className="text-steel">Scope</dt><dd className="whitespace-pre-line">{a.scope ?? '—'}</dd>
          <dt className="text-steel">Team</dt><dd>{a.teamMembers.length ? a.teamMembers.join(', ') : '—'}</dd>
          <dt className="text-steel">Assessed on</dt><dd>{fmtDate(a.assessedAt)}</dd>
        </dl>
        <RiskMatrix markers={markers} caption="Risk matrix with hazards plotted" />
      </section>

      <table className="w-full table-fixed border-collapse text-left text-xs">
        <caption className="sr-only">Hazard register</caption>
        <thead>
          <tr className="border-y-2 border-ink bg-canvas">
            <th scope="col" className="w-7 px-1.5 py-1.5">#</th>
            {jsa && <th scope="col" className="w-[11%] px-1.5 py-1.5">Task step</th>}
            <th scope="col" className="px-1.5 py-1.5">Hazard and consequence</th>
            <th scope="col" className="w-[10%] px-1.5 py-1.5">Initial risk</th>
            <th scope="col" className="w-[28%] px-1.5 py-1.5">Controls and PPE</th>
            <th scope="col" className="w-[10%] px-1.5 py-1.5">Residual risk</th>
            <th scope="col" className="w-[10%] px-1.5 py-1.5">Responsible</th>
          </tr>
        </thead>
        <tbody>
          {a.hazards.map((h, i) => (
            <tr key={h.id} className="break-inside-avoid border-b border-line align-top">
              <td className="px-1.5 py-1.5 font-bold">{i + 1}</td>
              {jsa && <td className="px-1.5 py-1.5">{h.taskStep}</td>}
              <td className="px-1.5 py-1.5">
                <p className="font-semibold">{h.hazard}</p>
                <p>{h.consequence}</p>
                {h.whoAtRisk && <p className="text-steel">At risk: {h.whoAtRisk}</p>}
              </td>
              <td className="px-1.5 py-1.5"><RiskLevelChip level={h.initialLevel} score={h.initialScore} /><p className="mt-0.5 text-steel">L{h.initialLikelihood} × S{h.initialSeverity}</p></td>
              <td className="px-1.5 py-1.5">
                <p>{h.controlMeasures}</p>
                <p className="text-steel">Strongest control: {CONTROL_LABEL[h.controlHierarchy].toLowerCase()}</p>
                {h.requiredPpe.length > 0 && <p>PPE: {h.requiredPpe.join(', ')}</p>}
              </td>
              <td className="px-1.5 py-1.5">
                {h.residualLevel && h.residualScore !== null
                  ? <><RiskLevelChip level={h.residualLevel} score={h.residualScore} /><p className="mt-0.5 text-steel">L{h.residualLikelihood} × S{h.residualSeverity}</p></>
                  : 'Not rated'}
              </td>
              <td className="px-1.5 py-1.5">{h.responsibleName ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="grid grid-cols-2 gap-8 pt-4 text-sm print:break-inside-avoid" aria-label="Sign-off">
        {[
          ['Prepared by', a.assessorName, fmtDate(a.assessedAt)],
          ['Approved by', a.approverName ?? '', a.approvedAt ? fmtDate(a.approvedAt) : ''],
        ].map(([role, name, date]) => (
          <div key={role}>
            <p className="font-semibold">{role}</p>
            <p className="mt-6 border-b border-ink pb-1">{name}</p>
            <p className="mt-1 text-xs text-steel">Signature</p>
            <p className="mt-3 border-b border-ink pb-1">{date}</p>
            <p className="mt-1 text-xs text-steel">Date</p>
          </div>
        ))}
      </section>

      {a.approvalNotes && <p className="text-xs"><span className="font-semibold">Approval note: </span>{a.approvalNotes}</p>}
      <footer className="border-t border-line pt-2 text-[11px] text-steel">
        Printed {fmtDayInZone(new Date(), site.timezone)} by {user.fullName}. This copy is controlled only while the status is Approved and the review date has not passed.
      </footer>
    </div>
  );
}
