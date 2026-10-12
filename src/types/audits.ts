import type { AuditStandard, InspectionResult, InspectionStatus, NcrSeverity, NcrStatus } from '@prisma/client';

export interface InspectionRow {
  id: string;
  referenceNo: string;
  checklistTitle: string;
  standard: AuditStandard;
  inspectorId: string;
  inspectorName: string;
  scheduledDate: Date;
  completedDate: Date | null;
  scorePercentage: number | null;
  status: InspectionStatus;
  overdue: boolean;
  answered: number;
  totalQuestions: number;
  openNcrs: number;
}

export interface ExecutionQuestion {
  id: string; category: string; question: string; guidanceNote: string | null; weight: number;
}
export interface ExecutionResponse {
  questionId: string; result: InspectionResult; findingDescription: string | null; evidenceUrls: string[]; hasNcr: boolean;
}
export interface ExecutionData {
  inspection: {
    id: string; referenceNo: string; checklistTitle: string; standard: AuditStandard;
    status: InspectionStatus; inspectorId: string; inspectorName: string;
  };
  questions: ExecutionQuestion[];
  responses: ExecutionResponse[];
}

export interface NcrLite {
  id: string; referenceNo: string; severity: NcrSeverity; status: NcrStatus; summary: string;
  containmentActions: string | null;
  capaId: string | null; capaRef: string | null; closureNotes: string | null;
}
export interface DetailItem {
  questionId: string; question: string; guidanceNote: string | null; weight: number;
  result: InspectionResult | null; findingDescription: string | null; evidenceUrls: string[];
  responseId: string | null; ncr: NcrLite | null;
}
export interface InspectionDetail {
  id: string; referenceNo: string; status: InspectionStatus; overdue: boolean;
  checklistTitle: string; checklistDescription: string; standard: AuditStandard;
  inspectorId: string; inspectorName: string; createdByName: string;
  scheduledDate: Date; startedAt: Date | null; completedDate: Date | null;
  scorePercentage: number | null; cancelReason: string | null;
  categories: { category: string; items: DetailItem[] }[];
  ncrs: (NcrLite & { question: string; raisedByName: string })[];
}

export interface NcrTarget {
  responseId: string; inspectionId: string; inspectionRef: string;
  question: string; category: string; finding: string;
  ncr: { id: string; referenceNo: string; severity: NcrSeverity; summary: string } | null;
  eligible: boolean; reason: string | null;
}

export interface NcrRegisterRow {
  id: string; referenceNo: string; severity: NcrSeverity; status: NcrStatus; summary: string;
  inspectionId: string; inspectionRef: string; capaRef: string | null; createdAt: Date;
}
