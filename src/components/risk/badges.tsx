import type { AssessmentStatus, RiskLevel } from '@prisma/client';
import { Clock } from 'lucide-react';
import { LEVEL_META } from '@/lib/risk/matrix';
import { ASSESSMENT_STATUS_LABEL } from '@/lib/risk/workflow';

export function RiskLevelChip({ level, score }: { level: RiskLevel; score?: number }) {
  const m = LEVEL_META[level];
  return (
    <span
      className="inline-block whitespace-nowrap rounded border px-2 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: m.bg, borderColor: m.border, color: m.text }}
    >
      {m.label}{score !== undefined && ` (${score})`}
    </span>
  );
}

const STATUS_COLOR: Record<AssessmentStatus, string> = {
  DRAFT: '#9AA5B1', IN_REVIEW: '#C98A00', APPROVED: '#1E7B4F', EXPIRED: '#B3261E', ARCHIVED: '#9AA5B1',
};

export function AssessmentStatusBadge({ status }: { status: AssessmentStatus }) {
  const c = STATUS_COLOR[status];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${c}1A`, borderColor: `${c}66` }}>
      <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: c }} />
      {ASSESSMENT_STATUS_LABEL[status]}
    </span>
  );
}

export const ReviewOverdueTag = () => (
  <span className="inline-flex items-center gap-1 text-xs font-semibold text-noncompliant">
    <Clock size={13} aria-hidden /> Review overdue
  </span>
);
