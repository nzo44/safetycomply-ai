-- Constraints Prisma can't express. Apply once, after the first migration:
--   npx prisma migrate dev --create-only --name init
--   (append this file's contents to the generated migration.sql)
--   npx prisma migrate dev

-- CAPA needs an origin: incident, RCA, compliance audit or inspection
ALTER TABLE capa_actions ADD CONSTRAINT capa_has_origin CHECK (
  "incidentId" IS NOT NULL OR "rcaId" IS NOT NULL OR "auditId" IS NOT NULL OR "inspectionId" IS NOT NULL);
ALTER TABLE capa_actions ADD CONSTRAINT capa_escalation_level CHECK ("escalationLevel" BETWEEN 0 AND 3);

ALTER TABLE incidents ADD CONSTRAINT incident_counts_nonneg
  CHECK ("injuredCount" >= 0 AND "fatalityCount" >= 0 AND "lostTimeDays" >= 0);

-- Weighbridge arithmetic is enforced by the database, not only by the app
ALTER TABLE weighbridge_tickets ADD CONSTRAINT ticket_weights_valid
  CHECK ("tareWeightKg" >= 0
     AND "grossWeightKg" > "tareWeightKg"
     AND "netWeightKg" = "grossWeightKg" - "tareWeightKg");

ALTER TABLE landfill_capacities ADD CONSTRAINT landfill_values_valid
  CHECK ("totalCapacityTons" > 0 AND "currentVolumeTons" >= 0);

-- Hazard ratings: scales, arithmetic and "controls can't make it worse"
ALTER TABLE hazard_items ADD CONSTRAINT hazard_scores_valid CHECK (
  "initialLikelihood" BETWEEN 1 AND 5 AND "initialSeverity" BETWEEN 1 AND 5
  AND "initialScore" = "initialLikelihood" * "initialSeverity"
  AND (
    ("residualLikelihood" IS NULL AND "residualSeverity" IS NULL AND "residualScore" IS NULL AND "residualLevel" IS NULL)
    OR ("residualLikelihood" BETWEEN 1 AND 5 AND "residualSeverity" BETWEEN 1 AND 5
        AND "residualScore" = "residualLikelihood" * "residualSeverity"
        AND "residualLevel" IS NOT NULL AND "residualScore" <= "initialScore")
  )
);

-- One live approved version per risk assessment reference, and one open revision at a time
CREATE UNIQUE INDEX one_approved_version ON risk_assessments ("referenceNo") WHERE status = 'APPROVED';
CREATE UNIQUE INDEX one_open_revision    ON risk_assessments ("referenceNo") WHERE status IN ('DRAFT', 'IN_REVIEW');

-- Inspections and checklists
ALTER TABLE checklist_questions ADD CONSTRAINT question_weight_range CHECK (weight BETWEEN 1 AND 5);
ALTER TABLE audit_inspections ADD CONSTRAINT score_range
  CHECK ("scorePercentage" IS NULL OR "scorePercentage" BETWEEN 0 AND 100);
ALTER TABLE audit_inspections ADD CONSTRAINT completed_has_date
  CHECK (status <> 'COMPLETED' OR "completedDate" IS NOT NULL);
ALTER TABLE inspection_responses ADD CONSTRAINT failed_item_has_finding
  CHECK (result <> 'NON_COMPLIANT' OR btrim(coalesce("findingDescription", '')) <> '');
