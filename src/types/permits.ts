import type { PermitDisplayStatus, PermitStatus, PermitType } from '@/lib/permits/meta';

/** Plain values only, so rows can cross the server -> client boundary. */
export interface PermitRow {
  id: string;
  permitCode: string;
  type: PermitType;
  status: PermitStatus;
  displayStatus: PermitDisplayStatus;
  title: string;
  location: string;
  description: string;
  hazards: string;
  precautions: string;
  workers: string | null;
  validFrom: Date;
  validTo: Date;
  requestedByName: string;
  requestedById: string;
  approvedByName: string | null;
  statusNote: string | null;
  closeoutNotes: string | null;
}

export interface PermitSummary {
  awaiting: number;
  active: number;
  expired: number;
}
