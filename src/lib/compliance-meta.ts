import type { ComplianceStatus, Priority, RequirementCategory } from '@prisma/client';

export const STATUS_ORDER: ComplianceStatus[] = [
  'COMPLIANT', 'PARTIALLY_COMPLIANT', 'NON_COMPLIANT', 'PENDING_REVIEW', 'NOT_APPLICABLE',
];

export const STATUS_LABEL: Record<ComplianceStatus, string> = {
  COMPLIANT: 'Compliant',
  PARTIALLY_COMPLIANT: 'Partially compliant',
  NON_COMPLIANT: 'Non-compliant',
  PENDING_REVIEW: 'Pending review',
  NOT_APPLICABLE: 'Not applicable',
};

export const STATUS_COLOR: Record<ComplianceStatus, string> = {
  COMPLIANT: '#1E7B4F',
  PARTIALLY_COMPLIANT: '#C98A00',
  NON_COMPLIANT: '#B3261E',
  PENDING_REVIEW: '#4A6FA5',
  NOT_APPLICABLE: '#9AA5B1',
};

export const CATEGORY_LABEL: Record<RequirementCategory, string> = {
  AIR_EMISSIONS: 'Air emissions',
  WATER_DISCHARGE: 'Water discharge',
  WASTE_MANAGEMENT: 'Waste management',
  OCCUPATIONAL_SAFETY: 'Occupational safety',
  FIRE_SAFETY: 'Fire safety',
  CHEMICAL_MANAGEMENT: 'Chemical management',
  NOISE: 'Noise',
  PERMITS_LICENSES: 'Permits and licences',
  OTHER: 'Other',
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', CRITICAL: 'Critical',
};

/** CAPA due-date offsets (days) by gap severity. */
export const CAPA_DUE_DAYS: Record<Priority, number> = {
  CRITICAL: 7, HIGH: 30, MEDIUM: 60, LOW: 90,
};
