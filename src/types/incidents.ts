import type {
  ActivityEntity, CapaStatus, CapaType, Priority, RcaMethod, RcaStatus, RootCauseCategory,
} from '@prisma/client';

export type { Option } from './common';

export interface WhyStep { level: number; why: string; answer: string }

export interface CapaCardData {
  id: string;
  referenceNo: string;
  title: string;
  description: string;
  type: CapaType;
  status: CapaStatus;
  priority: Priority;
  assigneeId: string;
  assigneeName: string;
  dueDate: Date;
  /** null when not overdue; derived from dueDate, never stored. */
  overdueDays: number | null;
  escalationLevel: number;
  escalatedToName: string | null;
  incidentId: string | null;
  incidentRef: string | null;
  inspectionId: string | null;
  inspectionRef: string | null;
  completionNotes: string | null;
  effectivenessNotes: string | null;
}

export interface RcaView {
  id: string;
  status: RcaStatus;
  method: RcaMethod;
  leadId: string;
  leadName: string;
  approverName: string | null;
  problemStatement: string;
  whyChain: WhyStep[];
  rootCause: string | null;
  rootCauseCategory: RootCauseCategory | null;
  contributingFactors: string[];
  completedAt: Date | null;
  approvedAt: Date | null;
}

export interface TimelineEntry {
  id: string;
  entityType: ActivityEntity;
  entityId: string;
  action: string;
  metadata: Record<string, unknown>;
  actorName: string | null; // null = system
  createdAt: Date;
}
