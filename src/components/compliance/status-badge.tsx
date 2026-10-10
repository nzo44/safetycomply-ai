import type { ComplianceStatus } from '@prisma/client';
import { CheckCircle2, CircleDashed, Clock, MinusCircle, XCircle, type LucideIcon } from 'lucide-react';
import { STATUS_COLOR, STATUS_LABEL } from '@/lib/compliance-meta';

const ICON: Record<ComplianceStatus, LucideIcon> = {
  COMPLIANT: CheckCircle2,
  PARTIALLY_COMPLIANT: CircleDashed,
  NON_COMPLIANT: XCircle,
  PENDING_REVIEW: Clock,
  NOT_APPLICABLE: MinusCircle,
};

export function StatusBadge({ status }: { status: ComplianceStatus }) {
  const Icon = ICON[status];
  const color = STATUS_COLOR[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium text-ink"
      style={{ backgroundColor: `${color}1A`, borderColor: `${color}66` }}
    >
      <Icon size={14} aria-hidden style={{ color }} />
      {STATUS_LABEL[status]}
    </span>
  );
}
