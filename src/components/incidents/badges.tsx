import type { CapaStatus, IncidentSeverity, IncidentStatus } from '@prisma/client';
import { ArrowUpCircle, Clock } from 'lucide-react';
import {
  CAPA_STATUS_COLOR, CAPA_STATUS_TITLE, INCIDENT_STATUS_COLOR, INCIDENT_STATUS_LABEL,
  SEVERITY_CLASS, SEVERITY_LABEL,
} from '@/lib/incidents-meta';

function Tint({ label, color }: { label: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${color}1A`, borderColor: `${color}66` }}>
      <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

export const IncidentStatusBadge = ({ status }: { status: IncidentStatus }) =>
  <Tint label={INCIDENT_STATUS_LABEL[status]} color={INCIDENT_STATUS_COLOR[status]} />;

export const CapaStatusBadge = ({ status }: { status: CapaStatus }) =>
  <Tint label={CAPA_STATUS_TITLE[status]} color={CAPA_STATUS_COLOR[status]} />;

export const SeverityBadge = ({ severity }: { severity: IncidentSeverity }) => (
  <span className={`inline-block whitespace-nowrap rounded border px-2 py-0.5 text-xs font-semibold ${SEVERITY_CLASS[severity]}`}>
    {SEVERITY_LABEL[severity]}
  </span>
);

export const OverdueTag = ({ days }: { days: number }) => (
  <span className="inline-flex items-center gap-1 text-xs font-semibold text-noncompliant">
    <Clock size={13} aria-hidden /> {days === 0 ? 'Overdue since today' : `${days} day${days === 1 ? '' : 's'} overdue`}
  </span>
);

export const EscalationTag = ({ level, to }: { level: number; to: string | null }) => (
  <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-900"
    title={to ? `Escalated to ${to}` : undefined}>
    <ArrowUpCircle size={13} aria-hidden /> Escalated, level {level}
  </span>
);
