import { AlertTriangle, Flame, HardHat, Pickaxe, Shield, Zap, type LucideIcon } from 'lucide-react';
import { PERMIT_STATUS_LABEL, PERMIT_TYPE_LABEL, type PermitDisplayStatus, type PermitType } from '@/lib/permits/meta';

const STATUS_COLOR: Record<PermitDisplayStatus, string> = {
  REQUESTED: '#4A6FA5', APPROVED: '#1E7B4F', IN_PROGRESS: '#C98A00', CLOSED: '#6B7885',
  REJECTED: '#B3261E', CANCELLED: '#9AA5B1', EXPIRED: '#B3261E',
};

export function PermitStatusBadge({ status }: { status: PermitDisplayStatus }) {
  const color = STATUS_COLOR[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${color}1A`, borderColor: `${color}66` }}
    >
      <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {PERMIT_STATUS_LABEL[status]}
    </span>
  );
}

const TYPE_ICON: Record<PermitType, LucideIcon> = {
  HOT_WORK: Flame, CONFINED_SPACE: Shield, WORK_AT_HEIGHT: HardHat, ELECTRICAL: Zap, EXCAVATION: Pickaxe, OTHER: AlertTriangle,
};

export function PermitTypeTag({ type }: { type: PermitType }) {
  const Icon = TYPE_ICON[type];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded border border-line bg-canvas px-2 py-0.5 text-xs font-medium text-steel">
      <Icon size={13} aria-hidden />
      {PERMIT_TYPE_LABEL[type]}
    </span>
  );
}
