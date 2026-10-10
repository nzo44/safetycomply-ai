'use client';

import { createContext, useContext } from 'react';
import { escalateCapa, extendCapaDueDate, reassignCapa, transitionCapa, verifyCapa } from '@/actions/incidents/capa';
import { ActionPanel } from '@/components/ui/action-panel';
import { MAX_ESCALATION_LEVEL } from '@/lib/incidents/workflow';
import type { Option } from '@/types/common';
import type { CapaCardData } from '@/types/incidents';

interface CapaContext {
  viewerId: string;
  canManage: boolean;
  canVerify: boolean;
  people: Option[];
  escalationTargets: Option[];
  today: string;
}

const Ctx = createContext<CapaContext | null>(null);

export function CapaProvider({ value, children }: { value: CapaContext; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function CapaActions({ capa }: { capa: CapaCardData }) {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('CapaActions must be rendered inside CapaProvider');
  const { viewerId, canManage, canVerify, people, escalationTargets, today } = ctx;

  const isAssignee = capa.assigneeId === viewerId;
  const canWork = isAssignee || canManage;
  const hidden = { capaId: capa.id };
  const active = capa.status === 'OPEN' || capa.status === 'IN_PROGRESS';
  const open = active || capa.status === 'PENDING_VERIFICATION';

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-start gap-2">
        {capa.status === 'OPEN' && canWork && (
          <ActionPanel immediate action={transitionCapa} label="Start work" hidden={{ ...hidden, toStatus: 'IN_PROGRESS' }} />
        )}
        {capa.status === 'IN_PROGRESS' && canWork && (
          <ActionPanel action={transitionCapa} label="Submit for verification" submitLabel="Submit"
            hidden={{ ...hidden, toStatus: 'PENDING_VERIFICATION' }}
            fields={[{ name: 'notes', label: 'Completion notes', kind: 'textarea', required: true, hint: 'What was done, and where the evidence is.' }]} />
        )}
        {capa.status === 'PENDING_VERIFICATION' && canVerify && !isAssignee && (
          <ActionPanel action={verifyCapa} label="Verify" submitLabel="Record outcome" hidden={hidden}
            fields={[
              { name: 'outcome', label: 'Outcome', kind: 'select', required: true,
                options: [{ value: 'effective', label: 'Effective: close the action' }, { value: 'ineffective', label: 'Not effective: send back' }] },
              { name: 'effectivenessNotes', label: 'How effectiveness was checked', kind: 'textarea', required: true },
            ]} />
        )}
        {capa.status === 'PENDING_VERIFICATION' && canWork && (
          <ActionPanel immediate action={transitionCapa} label="Withdraw" hidden={{ ...hidden, toStatus: 'IN_PROGRESS' }} />
        )}
      </div>

      {canManage && capa.status !== 'CANCELLED' && (
        <details className="group">
          <summary className="cursor-pointer text-xs font-medium text-steel hover:text-ink">Manage</summary>
          <div className="mt-2 flex flex-wrap items-start gap-2">
            {open && (
              <ActionPanel action={reassignCapa} label="Reassign" hidden={hidden}
                fields={[
                  { name: 'assigneeId', label: 'New assignee', kind: 'select', required: true, options: people.filter((p) => p.value !== capa.assigneeId) },
                  { name: 'reason', label: 'Reason', kind: 'text' },
                ]} />
            )}
            {active && (
              <ActionPanel action={extendCapaDueDate} label="Change due date" hidden={hidden}
                intro="Moving the date resets the escalation level. The change is logged."
                fields={[
                  { name: 'newDueDate', label: 'New due date', kind: 'date', required: true, min: today },
                  { name: 'reason', label: 'Reason', kind: 'textarea', required: true },
                ]} />
            )}
            {active && capa.escalationLevel < MAX_ESCALATION_LEVEL && (
              <ActionPanel action={escalateCapa} label="Escalate" hidden={hidden}
                fields={[
                  { name: 'toUserId', label: 'Escalate to', kind: 'select', required: true, options: escalationTargets.filter((p) => p.value !== capa.assigneeId) },
                  { name: 'reason', label: 'Reason', kind: 'textarea', required: true },
                ]} />
            )}
            {active && (
              <ActionPanel tone="danger" action={transitionCapa} label="Cancel action" submitLabel="Cancel action"
                hidden={{ ...hidden, toStatus: 'CANCELLED' }}
                fields={[{ name: 'notes', label: 'Reason for cancelling', kind: 'textarea', required: true }]} />
            )}
            {capa.status === 'CLOSED' && (
              <ActionPanel tone="danger" action={transitionCapa} label="Reopen" hidden={{ ...hidden, toStatus: 'IN_PROGRESS' }}
                fields={[{ name: 'notes', label: 'Why is it being reopened?', kind: 'textarea', required: true }]} />
            )}
          </div>
        </details>
      )}
    </div>
  );
}
