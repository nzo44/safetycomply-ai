import type {
  AssessmentStatus, AssessmentType, ControlHierarchy, RiskLevel,
} from '@prisma/client';

export interface HazardView {
  id: string;
  sortOrder: number;
  taskStep: string | null;
  hazard: string;
  consequence: string;
  whoAtRisk: string | null;
  initialLikelihood: number;
  initialSeverity: number;
  initialScore: number;
  initialLevel: RiskLevel;
  controlMeasures: string;
  controlHierarchy: ControlHierarchy;
  requiredPpe: string[];
  residualLikelihood: number | null;
  residualSeverity: number | null;
  residualScore: number | null;
  residualLevel: RiskLevel | null;
  responsibleId: string | null;
  responsibleName: string | null;
}

export interface VersionRef { id: string; version: number; status: AssessmentStatus }

export interface AssessmentView {
  id: string;
  referenceNo: string;
  version: number;
  status: AssessmentStatus;
  type: AssessmentType;
  title: string;
  activity: string;
  area: string | null;
  scope: string | null;
  teamMembers: string[];
  assessorId: string;
  assessorName: string;
  approverName: string | null;
  assessedAt: Date;
  submittedAt: Date | null;
  approvedAt: Date | null;
  approvalNotes: string | null;
  nextReviewDate: Date | null;
  hazards: HazardView[];
  versions: VersionRef[]; // every version of this reference, newest first
}

export interface RegisterRow {
  id: string;
  referenceNo: string;
  version: number;
  title: string;
  type: AssessmentType;
  area: string | null;
  status: AssessmentStatus;
  hazardCount: number;
  peakResidual: RiskLevel | null; // null when no hazard has been rated after controls
  peakInitial: RiskLevel | null;
  nextReviewDate: Date | null;
  reviewOverdue: boolean;
}
