import Link from 'next/link';
import type { AssessmentType } from '@prisma/client';
import { Pencil } from 'lucide-react';
import { deleteHazard, moveHazard } from '@/actions/risk/hazards';
import { ActionPanel } from '@/components/ui/action-panel';
import { withParams, type SearchParams } from '@/lib/data/params';
import { CONTROL_LABEL } from '@/lib/risk/workflow';
import type { HazardView } from '@/types/risk';
import { RiskLevelChip } from './badges';

export interface HazardListProps {
  hazards: HazardView[];
  type: AssessmentType;
  canEdit: boolean;
  assessmentId: string;
  sp: SearchParams;
}

export function HazardList({ hazards, type, canEdit, assessmentId, sp }: HazardListProps) {
  if (hazards.length === 0) {
    return (
      <p className="rounded border border-line bg-white p-5 text-sm text-steel">
        No hazards yet.{canEdit ? ' Add the first hazard to start rating risk.' : ''}
      </p>
    );
  }
  const base = `/risk/${assessmentId}`;

  return (
    <ol className="space-y-3">
      {hazards.map((h, i) => (
        <li key={h.id} className="space-y-3 rounded border border-line bg-white p-4">
          <div className="flex items-start gap-3">
            <span aria-hidden className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-white">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="sr-only">Hazard {i + 1}</p>
              {type === 'JSA' && h.taskStep && <p className="text-xs font-medium text-plant">Step: {h.taskStep}</p>}
              <h3 className="text-sm font-semibold">{h.hazard}</h3>
              <p className="text-sm text-steel">Could result in: {h.consequence}</p>
              {h.whoAtRisk && <p className="text-xs text-steel">At risk: {h.whoAtRisk}</p>}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-steel">
              <RiskLevelChip level={h.initialLevel} score={h.initialScore} />
              <span>before controls</span>
              {h.residualLevel && h.residualScore !== null
                ? <><RiskLevelChip level={h.residualLevel} score={h.residualScore} /><span>after controls</span></>
                : <span className="font-medium text-partial">Residual not rated</span>}
            </div>
          </div>

          <div className="space-y-1 border-t border-line pt-3 text-sm">
            <p><span className="font-medium">Controls ({CONTROL_LABEL[h.controlHierarchy].toLowerCase()}): </span>{h.controlMeasures}</p>
            {h.requiredPpe.length > 0 && <p><span className="font-medium">PPE: </span>{h.requiredPpe.join(', ')}</p>}
            <p className="text-xs text-steel">Responsible: {h.responsibleName ?? 'Unassigned'}</p>
          </div>

          {canEdit && (
            <div className="flex flex-wrap items-start gap-2 border-t border-line pt-3">
              <Link href={withParams(sp, { hazard: h.id }, base)} scroll={false}
                className="inline-flex items-center gap-1.5 rounded border border-plant px-3 py-1.5 text-xs font-semibold text-plant hover:bg-plant/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-plant">
                <Pencil size={13} aria-hidden /> Edit<span className="sr-only"> hazard {i + 1}</span>
              </Link>
              {i > 0 && <ActionPanel immediate action={moveHazard} label="Move up" hidden={{ hazardId: h.id, direction: 'up' }} />}
              {i < hazards.length - 1 && <ActionPanel immediate action={moveHazard} label="Move down" hidden={{ hazardId: h.id, direction: 'down' }} />}
              <ActionPanel tone="danger" action={deleteHazard} label="Remove" submitLabel="Remove hazard" hidden={{ hazardId: h.id }}
                intro="This permanently removes the hazard from the draft." />
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
