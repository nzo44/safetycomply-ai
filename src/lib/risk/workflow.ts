import type { AssessmentStatus, AssessmentType, ControlHierarchy, RiskLevel } from '@prisma/client';
import { levelRank } from './matrix';

export const ASSESSMENT_STATUS_LABEL: Record<AssessmentStatus, string> = {
  DRAFT: 'Draft', IN_REVIEW: 'In review', APPROVED: 'Approved', EXPIRED: 'Expired', ARCHIVED: 'Archived',
};
export const ASSESSMENT_TYPE_LABEL: Record<AssessmentType, string> = {
  JSA: 'Job safety analysis (JSA)', HIRA: 'Hazard identification and risk assessment (HIRA)',
};
export const CONTROL_LABEL: Record<ControlHierarchy, string> = {
  ELIMINATION: 'Elimination', SUBSTITUTION: 'Substitution', ENGINEERING: 'Engineering controls',
  ADMINISTRATIVE: 'Administrative controls', PPE: 'Personal protective equipment',
};
export const MAX_HAZARDS = 100;

export interface HazardCheckInput {
  hazard: string;
  initialLevel: RiskLevel;
  residualLevel: RiskLevel | null;
  controlHierarchy: ControlHierarchy;
}

const nums = (idx: number[]) => idx.map((i) => `#${i + 1}`).join(', ');

/** Hazards must be passed in display order, because the numbers in messages match the on-screen numbering. */
export function approvalCheck(hazards: HazardCheckInput[]) {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const at = (pred: (h: HazardCheckInput) => boolean) => hazards.flatMap((h, i) => (pred(h) ? [i] : []));

  if (hazards.length === 0) blockers.push('Add at least one hazard');

  const unrated = at((h) => h.residualLevel === null);
  if (unrated.length) blockers.push(`Rate the residual risk (after controls) for hazard ${nums(unrated)}`);

  const extreme = at((h) => h.residualLevel === 'EXTREME');
  if (extreme.length) blockers.push(`Hazard ${nums(extreme)} still has an extreme residual risk. Add or strengthen controls before approval`);

  const weak = at((h) =>
    levelRank(h.initialLevel) >= levelRank('HIGH') && (h.controlHierarchy === 'PPE' || h.controlHierarchy === 'ADMINISTRATIVE'));
  if (weak.length) warnings.push(`Hazard ${nums(weak)} is high or extreme risk but relies on administrative controls or PPE. Consider elimination, substitution or engineering controls`);

  const highResidual = at((h) => h.residualLevel === 'HIGH');
  if (highResidual.length) warnings.push(`Hazard ${nums(highResidual)} keeps a high residual risk. The approver must record why it is acceptable`);

  return { blockers, warnings, highResidualCount: highResidual.length };
}

/** Review sooner when more risk remains. */
export const reviewMonthsFor = (peakResidual: RiskLevel | null) =>
  peakResidual === 'HIGH' ? 6 : peakResidual === 'MEDIUM' ? 12 : 24;

export function addMonthsUtc(d: Date, months: number) {
  const r = new Date(d.getTime());
  r.setUTCMonth(r.getUTCMonth() + months);
  return r;
}

export const isReviewOverdue = (a: { status: AssessmentStatus; nextReviewDate: Date | null }, now = new Date()) =>
  a.status === 'APPROVED' && a.nextReviewDate !== null && a.nextReviewDate.getTime() < now.getTime();
