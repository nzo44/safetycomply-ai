import type { AuditStandard, InspectionResult, InspectionStatus, NcrSeverity, NcrStatus } from '@prisma/client';
import { Check, Minus, X } from 'lucide-react';
import {
  INSPECTION_STATUS_LABEL, NCR_SEVERITY_LABEL, NCR_STATUS_LABEL, RESULT_LABEL, STANDARD_LABEL,
} from '@/lib/audits/meta';

function Tint({ label, color }: { label: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${color}1A`, borderColor: `${color}66` }}>
      <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

const STATUS_COLOR: Record<InspectionStatus, string> = {
  SCHEDULED: '#4A6FA5', IN_PROGRESS: '#C98A00', COMPLETED: '#1E7B4F', CANCELLED: '#9AA5B1',
};

export const InspectionStatusBadge = ({ status, overdue }: { status: InspectionStatus; overdue?: boolean }) =>
  overdue ? <Tint label="Overdue" color="#B3261E" /> : <Tint label={INSPECTION_STATUS_LABEL[status]} color={STATUS_COLOR[status]} />;

export const StandardTag = ({ standard }: { standard: AuditStandard }) => (
  <span className="inline-block whitespace-nowrap rounded border border-line bg-canvas px-2 py-0.5 text-xs font-medium text-steel">
    {STANDARD_LABEL[standard]}
  </span>
);

const SEVERITY_CLASS: Record<NcrSeverity, string> = {
  MINOR: 'border-line bg-canvas text-steel',
  MAJOR: 'border-orange-300 bg-orange-100 text-orange-900',
  CRITICAL: 'border-noncompliant bg-noncompliant text-white',
};
export const NcrSeverityBadge = ({ severity }: { severity: NcrSeverity }) => (
  <span className={`inline-block whitespace-nowrap rounded border px-2 py-0.5 text-xs font-semibold ${SEVERITY_CLASS[severity]}`}>
    {NCR_SEVERITY_LABEL[severity]}
  </span>
);

const NCR_COLOR: Record<NcrStatus, string> = { OPEN: '#B3261E', CAPA_ISSUED: '#C98A00', CLOSED: '#1E7B4F' };
export const NcrStatusBadge = ({ status }: { status: NcrStatus }) => <Tint label={NCR_STATUS_LABEL[status]} color={NCR_COLOR[status]} />;

const RESULT_UI: Record<InspectionResult, { Icon: typeof Check; cls: string }> = {
  COMPLIANT: { Icon: Check, cls: 'border-compliant/50 bg-compliant/10 text-compliant' },
  NON_COMPLIANT: { Icon: X, cls: 'border-noncompliant/50 bg-noncompliant/10 text-noncompliant' },
  NOT_APPLICABLE: { Icon: Minus, cls: 'border-line bg-canvas text-steel' },
};
export function ResultBadge({ result }: { result: InspectionResult | null }) {
  if (!result) return <span className="text-xs font-medium text-steel">Not answered</span>;
  const { Icon, cls } = RESULT_UI[result];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded border px-2 py-0.5 text-xs font-semibold ${cls}`}>
      <Icon size={13} aria-hidden /> {RESULT_LABEL[result]}
    </span>
  );
}
