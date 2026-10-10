'use client';

import { useState } from 'react';
import { recordAudit } from '@/actions/compliance/audits';
import type { MatrixRow } from '@/types/compliance';
import { AuditModal } from './AuditModal';
import { ComplianceMatrixTable } from './ComplianceMatrixTable';

export interface ComplianceWorkspaceProps {
  rows: MatrixRow[];
  canAudit: boolean;
  emptyMessage?: string;
}

export function ComplianceWorkspace({ rows, canAudit, emptyMessage }: ComplianceWorkspaceProps) {
  const [target, setTarget] = useState<MatrixRow | null>(null);

  return (
    <>
      <ComplianceMatrixTable rows={rows} canAudit={canAudit} onAudit={setTarget} emptyMessage={emptyMessage} />
      <AuditModal open={target !== null} requirement={target} action={recordAudit} onClose={() => setTarget(null)} />
    </>
  );
}
