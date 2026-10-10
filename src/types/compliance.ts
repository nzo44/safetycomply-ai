import type { ComplianceStatus, Priority, RequirementCategory } from '@prisma/client';

export interface MatrixRow {
  id: string;
  title: string;
  citation: string;
  category: RequirementCategory;
  currentStatus: ComplianceStatus;
  ownerName: string | null;
  nextReviewDate: Date | null;
  lastAuditDate: Date | null;
  /** Gap severity from the latest audit; null when there is no recorded gap. */
  gapSeverity: Priority | null;
  /** Evidence links from the latest audit. */
  evidenceUrls: string[];
}
