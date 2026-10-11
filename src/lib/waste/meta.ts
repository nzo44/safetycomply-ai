import type { DisposalMethod, ManifestStatus, WasteType } from '@prisma/client';

export const WASTE_TYPE_LABEL: Record<WasteType, string> = {
  HAZARDOUS: 'Hazardous', NON_HAZARDOUS: 'Non-hazardous', INERT: 'Inert', RECYCLABLE: 'Recyclable',
  BIOMEDICAL: 'Biomedical', RADIOACTIVE: 'Radioactive', E_WASTE: 'Electronic waste', SLUDGE: 'Sludge',
};

export const MANIFEST_STATUS_LABEL: Record<ManifestStatus, string> = {
  DISPATCHED: 'Dispatched', IN_TRANSIT: 'In transit', DISCHARGED: 'Discharged',
  REJECTED: 'Rejected', CANCELLED: 'Cancelled',
};

export const DISPOSAL_LABEL: Record<DisposalMethod, string> = {
  LANDFILL: 'Landfill', INCINERATION: 'Incineration', RECYCLING: 'Recycling',
  TREATMENT: 'Treatment', REUSE: 'Reuse', STORAGE: 'Storage',
};

/** Counted in the "hazardous ratio" metric. E-waste and sludge are reported separately. */
export const HAZARDOUS_TYPES: WasteType[] = ['HAZARDOUS', 'BIOMEDICAL', 'RADIOACTIVE'];

/** Moves available through `updateManifestStatus`. DISCHARGED is reached only via `processDischarge`. */
export const MANIFEST_TRANSITIONS: Record<ManifestStatus, ManifestStatus[]> = {
  DISPATCHED: ['IN_TRANSIT', 'REJECTED', 'CANCELLED'],
  IN_TRANSIT: ['REJECTED', 'CANCELLED'],
  DISCHARGED: [],
  REJECTED: [],
  CANCELLED: [],
};

export const PROCESSABLE_STATUSES: ManifestStatus[] = ['DISPATCHED', 'IN_TRANSIT'];
export const PENDING_TRANSIT_STATUSES: ManifestStatus[] = ['DISPATCHED', 'IN_TRANSIT'];
