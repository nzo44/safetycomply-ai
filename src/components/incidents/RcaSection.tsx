import type { RcaView } from '@/types/incidents';
import { ActionPanel } from '@/components/ui/action-panel';
import { reviewRca } from '@/actions/incidents/rca';
import { RCA_STATUS_LABEL, ROOT_CAUSE_LABEL } from '@/lib/incidents-meta';
import { fmtDate } from '@/lib/utils';
import { WhyEditor } from './WhyEditor';

export interface RcaViewer { id: string; canManage: boolean; canWrite: boolean; canApprove: boolean }

function ChainView({ rca }: { rca: RcaView }) {
  return (
    <div className="space-y-5">
      <p className="max-w-prose text-sm">{rca.problemStatement}</p>
      <ol className="space-y-3">
        {rca.whyChain.map((s) => (
          <li key={s.level} className="flex gap-3">
            <span aria-hidden className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-plant text-sm font-semibold text-white">{s.level}</span>
            <div>
              <p className="text-sm text-steel">{s.why}</p>
              <p className="text-sm font-medium">{s.answer}</p>
            </div>
          </li>
        ))}
      </ol>
      {rca.rootCause && (
        <div className="border-l-4 border-plant bg-canvas p-4">
          <p className="text-sm font-semibold">
            Root cause{rca.rootCauseCategory ? `: ${ROOT_CAUSE_LABEL[rca.rootCauseCategory]}` : ''}
          </p>
          <p className="mt-1 text-sm">{rca.rootCause}</p>
        </div>
      )}
      {rca.contributingFactors.length > 0 && (
        <div>
          <p className="text-sm font-semibold">Contributing factors</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
            {rca.contributingFactors.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

export function RcaSection({ incidentId, rca, viewer }: { incidentId: string; rca: RcaView | null; viewer: RcaViewer }) {
  if (!rca) {
    return <p className="rounded border border-line bg-white p-5 text-sm text-steel">No investigation yet. A manager starts it by choosing a lead.</p>;
  }

  const editable = rca.status === 'DRAFT' && viewer.canWrite && (viewer.id === rca.leadId || viewer.canManage);
  const isLead = viewer.id === rca.leadId;

  return (
    <div className="space-y-4 rounded border border-line bg-white p-5">
      <p className="text-sm text-steel">
        {RCA_STATUS_LABEL[rca.status]}. Led by {rca.leadName}
        {rca.approverName && `, approved by ${rca.approverName} on ${fmtDate(rca.approvedAt)}`}
      </p>

      {editable && rca.method === 'FIVE_WHYS' ? (
        <WhyEditor
          incidentId={incidentId}
          defaults={{
            problemStatement: rca.problemStatement,
            answers: rca.whyChain.map((s) => s.answer),
            rootCause: rca.rootCause ?? '',
            rootCauseCategory: rca.rootCauseCategory ?? '',
            contributingFactors: rca.contributingFactors.join('\n'),
          }}
        />
      ) : editable ? (
        <p className="text-sm text-steel">The editor for this analysis method is not available yet. Use 5 Whys.</p>
      ) : rca.status === 'DRAFT' ? (
        <p className="text-sm text-steel">{rca.leadName} is still working on this analysis.</p>
      ) : (
        <ChainView rca={rca} />
      )}

      {rca.status === 'SUBMITTED' && viewer.canApprove && !isLead && (
        <ActionPanel action={reviewRca} label="Review analysis" submitLabel="Record decision" hidden={{ rcaId: rca.id }}
          fields={[
            { name: 'decision', label: 'Decision', kind: 'select', required: true,
              options: [{ value: 'approve', label: 'Approve' }, { value: 'return', label: 'Return to the lead' }] },
            { name: 'comments', label: 'Comments', kind: 'textarea', hint: 'Required when returning.' },
          ]} />
      )}
      {rca.status === 'SUBMITTED' && isLead && (
        <p className="text-xs text-steel">You led this analysis, so another HSE manager must review it.</p>
      )}
    </div>
  );
}
