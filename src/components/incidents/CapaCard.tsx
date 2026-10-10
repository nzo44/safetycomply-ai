import Link from 'next/link';
import { RiskChip } from '@/components/compliance/chips';
import { CAPA_TYPE_LABEL } from '@/lib/incidents-meta';
import { fmtDate } from '@/lib/utils';
import type { CapaCardData } from '@/types/incidents';
import { CapaStatusBadge, EscalationTag, OverdueTag } from './badges';
import { CapaActions } from './CapaActions';

export function CapaCard({ capa, showStatus = false }: { capa: CapaCardData; showStatus?: boolean }) {
  const muted = capa.status === 'CANCELLED' ? 'opacity-60' : '';
  return (
    <article className={`space-y-3 rounded border border-line border-l-4 bg-white p-4 ${capa.overdueDays !== null ? 'border-l-noncompliant' : 'border-l-line'} ${muted}`}>
      <header className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold">{capa.referenceNo}</span>
        <RiskChip level={capa.priority} />
        <span className="text-xs text-steel">{CAPA_TYPE_LABEL[capa.type]}</span>
        {showStatus && <CapaStatusBadge status={capa.status} />}
      </header>

      <div>
        <h3 className="text-sm font-semibold">{capa.title}</h3>
        {capa.incidentId ? (
          <Link href={`/incidents/${capa.incidentId}`} className="text-xs text-plant hover:underline">{capa.incidentRef}</Link>
        ) : capa.inspectionId ? (
          <Link href={`/audits/${capa.inspectionId}`} className="text-xs text-plant hover:underline">From inspection {capa.inspectionRef}</Link>
        ) : null}
      </div>

      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div><dt className="text-steel">Assignee</dt><dd className="font-medium">{capa.assigneeName}</dd></div>
        <div><dt className="text-steel">Due</dt><dd className="font-medium">{fmtDate(capa.dueDate)}</dd></div>
      </dl>

      {(capa.overdueDays !== null || capa.escalationLevel > 0) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {capa.overdueDays !== null && <OverdueTag days={capa.overdueDays} />}
          {capa.escalationLevel > 0 && <EscalationTag level={capa.escalationLevel} to={capa.escalatedToName} />}
        </div>
      )}

      {capa.status === 'PENDING_VERIFICATION' && capa.completionNotes && (
        <p className="border-l-2 border-partial pl-3 text-xs"><span className="font-medium">Completion notes: </span>{capa.completionNotes}</p>
      )}
      {capa.status === 'CLOSED' && capa.effectivenessNotes && (
        <p className="border-l-2 border-compliant pl-3 text-xs"><span className="font-medium">Effectiveness check: </span>{capa.effectivenessNotes}</p>
      )}

      <CapaActions capa={capa} />
    </article>
  );
}
