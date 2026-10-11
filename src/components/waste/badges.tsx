import type { ManifestStatus, WasteType } from '@prisma/client';
import { AlertTriangle, Box, Cpu, Droplets, Recycle, Trash2, type LucideIcon } from 'lucide-react';
import { HAZARDOUS_TYPES, MANIFEST_STATUS_LABEL, WASTE_TYPE_LABEL } from '@/lib/waste/meta';

const STATUS_COLOR: Record<ManifestStatus, string> = {
  DISPATCHED: '#4A6FA5', IN_TRANSIT: '#C98A00', DISCHARGED: '#1E7B4F', REJECTED: '#B3261E', CANCELLED: '#9AA5B1',
};

export function ManifestStatusBadge({ status }: { status: ManifestStatus }) {
  const color = STATUS_COLOR[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${color}1A`, borderColor: `${color}66` }}
    >
      <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {MANIFEST_STATUS_LABEL[status]}
    </span>
  );
}

const TYPE_ICON: Record<WasteType, LucideIcon> = {
  HAZARDOUS: AlertTriangle, BIOMEDICAL: AlertTriangle, RADIOACTIVE: AlertTriangle,
  NON_HAZARDOUS: Trash2, INERT: Box, RECYCLABLE: Recycle, E_WASTE: Cpu, SLUDGE: Droplets,
};

export function WasteTypeTag({ type }: { type: WasteType }) {
  const Icon = TYPE_ICON[type];
  const hazardous = HAZARDOUS_TYPES.includes(type);
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded border px-2 py-0.5 text-xs font-medium ${
        hazardous ? 'border-noncompliant/50 bg-noncompliant/5 text-noncompliant' : 'border-line bg-canvas text-steel'
      }`}
    >
      <Icon size={13} aria-hidden />
      {WASTE_TYPE_LABEL[type]}
    </span>
  );
}
