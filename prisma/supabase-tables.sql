-- SafetyComply AI: database tables for Supabase (PostgreSQL).
-- Generated from prisma/schema.prisma. Paste the whole file into the Supabase SQL editor and run it once on an EMPTY database.
-- It runs in a single transaction, so if anything fails nothing is created.
--
-- Contents: enums, tables, indexes, foreign keys, then the CHECK constraints and partial unique indexes
-- that Prisma cannot express (the same statements as prisma/constraints.sql).
--
-- After this, run (in the SQL editor): prisma/supabase-auth-trigger.sql, prisma/supabase-rls.sql, prisma/supabase-storage.sql.

BEGIN;

-- ===== Enums =====
CREATE TYPE "Role" AS ENUM ('ADMIN', 'HSE_MANAGER', 'INSPECTOR', 'AUDITOR');
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "ActivityEntity" AS ENUM ('INCIDENT', 'RCA', 'CAPA', 'WASTE_MANIFEST', 'LANDFILL', 'RISK_ASSESSMENT', 'CHECKLIST', 'INSPECTION', 'NCR', 'PERMIT');
CREATE TYPE "RequirementCategory" AS ENUM ('AIR_EMISSIONS', 'WATER_DISCHARGE', 'WASTE_MANAGEMENT', 'OCCUPATIONAL_SAFETY', 'FIRE_SAFETY', 'CHEMICAL_MANAGEMENT', 'NOISE', 'PERMITS_LICENSES', 'OTHER');
CREATE TYPE "ComplianceStatus" AS ENUM ('COMPLIANT', 'PARTIALLY_COMPLIANT', 'NON_COMPLIANT', 'NOT_APPLICABLE', 'PENDING_REVIEW');
CREATE TYPE "IncidentType" AS ENUM ('INJURY', 'ILLNESS', 'NEAR_MISS', 'PROPERTY_DAMAGE', 'ENVIRONMENTAL_RELEASE', 'FIRE_EXPLOSION', 'PROCESS_SAFETY', 'SECURITY', 'OTHER');
CREATE TYPE "IncidentSeverity" AS ENUM ('MINOR', 'MODERATE', 'MAJOR', 'CRITICAL', 'CATASTROPHIC');
CREATE TYPE "IncidentStatus" AS ENUM ('REPORTED', 'UNDER_INVESTIGATION', 'RCA_COMPLETE', 'CAPA_IN_PROGRESS', 'CLOSED');
CREATE TYPE "RcaMethod" AS ENUM ('FIVE_WHYS', 'FISHBONE', 'FAULT_TREE', 'BOW_TIE');
CREATE TYPE "RcaStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED');
CREATE TYPE "RootCauseCategory" AS ENUM ('HUMAN_FACTORS', 'EQUIPMENT_FAILURE', 'PROCEDURE_GAP', 'TRAINING_GAP', 'MANAGEMENT_SYSTEM', 'MATERIAL_OR_SUPPLIER', 'ENVIRONMENTAL_CONDITIONS', 'DESIGN_OR_ENGINEERING');
CREATE TYPE "CapaType" AS ENUM ('CORRECTIVE', 'PREVENTIVE');
CREATE TYPE "CapaStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'PENDING_VERIFICATION', 'CLOSED', 'CANCELLED');
CREATE TYPE "EscalationTrigger" AS ENUM ('AUTOMATIC', 'MANUAL');
CREATE TYPE "WasteType" AS ENUM ('HAZARDOUS', 'NON_HAZARDOUS', 'INERT', 'RECYCLABLE', 'BIOMEDICAL', 'RADIOACTIVE', 'E_WASTE', 'SLUDGE');
CREATE TYPE "ManifestStatus" AS ENUM ('DISPATCHED', 'IN_TRANSIT', 'DISCHARGED', 'REJECTED', 'CANCELLED');
CREATE TYPE "DisposalMethod" AS ENUM ('LANDFILL', 'INCINERATION', 'RECYCLING', 'TREATMENT', 'REUSE', 'STORAGE');
CREATE TYPE "DischargeMedium" AS ENUM ('WASTEWATER', 'STORMWATER', 'AIR_STACK', 'GROUNDWATER', 'SURFACE_WATER');
CREATE TYPE "AssessmentType" AS ENUM ('JSA', 'HIRA');
CREATE TYPE "AssessmentStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'EXPIRED', 'ARCHIVED');
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'EXTREME');
CREATE TYPE "ControlHierarchy" AS ENUM ('ELIMINATION', 'SUBSTITUTION', 'ENGINEERING', 'ADMINISTRATIVE', 'PPE');
CREATE TYPE "AuditStandard" AS ENUM ('ISO_14001', 'ISO_45001', 'LOCAL_REGULATORY', 'INTERNAL_HSE');
CREATE TYPE "InspectionStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "InspectionResult" AS ENUM ('COMPLIANT', 'NON_COMPLIANT', 'NOT_APPLICABLE');
CREATE TYPE "NcrSeverity" AS ENUM ('MINOR', 'MAJOR', 'CRITICAL');
CREATE TYPE "NcrStatus" AS ENUM ('OPEN', 'CAPA_ISSUED', 'CLOSED');

-- ===== Tables =====
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'INSPECTOR',
    "jobTitle" TEXT,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sites" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'DZ',
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Algiers',
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_sites" (
    "userId" UUID NOT NULL,
    "siteId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_sites_pkey" PRIMARY KEY ("userId", "siteId")
);

CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "actorId" UUID,
    "entityType" "ActivityEntity" NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reference_counters" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "reference_counters_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "legal_requirements" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "ownerId" UUID,
    "title" TEXT NOT NULL,
    "citation" TEXT NOT NULL,
    "authority" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "category" "RequirementCategory" NOT NULL,
    "description" TEXT,
    "obligation" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "effectiveDate" TIMESTAMP(3),
    "reviewFrequencyDays" INTEGER,
    "nextReviewDate" TIMESTAMP(3),
    "currentStatus" "ComplianceStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "legal_requirements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "compliance_audits" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "auditorId" UUID NOT NULL,
    "auditDate" TIMESTAMP(3) NOT NULL,
    "status" "ComplianceStatus" NOT NULL,
    "findings" TEXT,
    "gapDescription" TEXT,
    "gapSeverity" "Priority",
    "evidenceUrls" TEXT[],
    "nextAuditDue" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "compliance_audits_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "incidents" (
    "id" TEXT NOT NULL,
    "referenceNo" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "reportedById" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "IncidentType" NOT NULL,
    "severity" "IncidentSeverity" NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'REPORTED',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "immediateActions" TEXT,
    "injuredCount" INTEGER NOT NULL DEFAULT 0,
    "fatalityCount" INTEGER NOT NULL DEFAULT 0,
    "lostTimeDays" INTEGER NOT NULL DEFAULT 0,
    "isRecordable" BOOLEAN NOT NULL DEFAULT false,
    "isReportableToAuthority" BOOLEAN NOT NULL DEFAULT false,
    "authorityReportedAt" TIMESTAMP(3),
    "authorityReferenceNo" TEXT,
    "closureNotes" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rca_analyses" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "method" "RcaMethod" NOT NULL DEFAULT 'FIVE_WHYS',
    "status" "RcaStatus" NOT NULL DEFAULT 'DRAFT',
    "leadId" UUID NOT NULL,
    "approvedById" UUID,
    "problemStatement" TEXT NOT NULL,
    "whyChain" JSONB,
    "diagramData" JSONB,
    "rootCause" TEXT,
    "rootCauseCategory" "RootCauseCategory",
    "contributingFactors" TEXT[],
    "completedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "rca_analyses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "capa_actions" (
    "id" TEXT NOT NULL,
    "referenceNo" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "incidentId" TEXT,
    "rcaId" TEXT,
    "auditId" TEXT,
    "inspectionId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "CapaType" NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "status" "CapaStatus" NOT NULL DEFAULT 'OPEN',
    "assigneeId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "originalDueDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "completionNotes" TEXT,
    "verifiedById" UUID,
    "verifiedAt" TIMESTAMP(3),
    "effectivenessNotes" TEXT,
    "escalationLevel" INTEGER NOT NULL DEFAULT 0,
    "escalatedToId" UUID,
    "lastEscalatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "capa_actions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "capa_escalations" (
    "id" TEXT NOT NULL,
    "capaId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "toUserId" UUID NOT NULL,
    "trigger" "EscalationTrigger" NOT NULL,
    "reason" TEXT,
    "daysOverdue" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "capa_escalations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "escalation_rules" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "priority" "Priority" NOT NULL,
    "level" INTEGER NOT NULL,
    "afterDaysOverdue" INTEGER NOT NULL,
    "escalateToRole" "Role" NOT NULL,
    CONSTRAINT "escalation_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "waste_manifests" (
    "id" TEXT NOT NULL,
    "manifestCode" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "recordedById" UUID NOT NULL,
    "wasteType" "WasteType" NOT NULL,
    "wasteCode" TEXT,
    "description" TEXT NOT NULL,
    "disposalMethod" "DisposalMethod" NOT NULL DEFAULT 'LANDFILL',
    "estimatedWeightKg" DECIMAL(12,3),
    "transporterName" TEXT NOT NULL,
    "transporterLicenseNo" TEXT,
    "vehicleRegistration" TEXT,
    "driverName" TEXT,
    "destinationFacility" TEXT NOT NULL,
    "status" "ManifestStatus" NOT NULL DEFAULT 'DISPATCHED',
    "statusNote" TEXT,
    "dispatchedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3),
    "notes" TEXT,
    "attachmentUrls" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "waste_manifests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "weighbridge_tickets" (
    "id" TEXT NOT NULL,
    "manifestId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "operatorId" UUID NOT NULL,
    "weighbridgeTicketNo" TEXT NOT NULL,
    "wasteType" "WasteType" NOT NULL,
    "grossWeightKg" DECIMAL(12,3) NOT NULL,
    "tareWeightKg" DECIMAL(12,3) NOT NULL,
    "netWeightKg" DECIMAL(12,3) NOT NULL,
    "countedToLandfill" BOOLEAN NOT NULL,
    "dischargeDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "evidenceUrls" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "weighbridge_tickets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "discharge_logs" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "requirementId" TEXT,
    "sampledById" UUID NOT NULL,
    "medium" "DischargeMedium" NOT NULL,
    "outfallPoint" TEXT NOT NULL,
    "parameter" TEXT NOT NULL,
    "value" DECIMAL(14,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "limitValue" DECIMAL(14,4),
    "limitMin" DECIMAL(14,4),
    "isExceedance" BOOLEAN NOT NULL DEFAULT false,
    "sampledAt" TIMESTAMP(3) NOT NULL,
    "labReference" TEXT,
    "analysisMethod" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "discharge_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "landfill_capacities" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "totalCapacityTons" DECIMAL(16,6) NOT NULL,
    "currentVolumeTons" DECIMAL(16,6) NOT NULL DEFAULT 0,
    "projectedFillDate" TIMESTAMP(3),
    "lastSurveyedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "landfill_capacities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "risk_assessments" (
    "id" TEXT NOT NULL,
    "referenceNo" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parentId" TEXT,
    "siteId" TEXT NOT NULL,
    "assessorId" UUID NOT NULL,
    "approvedById" UUID,
    "title" TEXT NOT NULL,
    "type" "AssessmentType" NOT NULL DEFAULT 'HIRA',
    "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "activity" TEXT NOT NULL,
    "area" TEXT,
    "scope" TEXT,
    "teamMembers" TEXT[],
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvalNotes" TEXT,
    "nextReviewDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "risk_assessments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "hazard_items" (
    "id" TEXT NOT NULL,
    "riskAssessmentId" TEXT NOT NULL,
    "responsibleId" UUID,
    "capaActionId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "taskStep" TEXT,
    "hazard" TEXT NOT NULL,
    "consequence" TEXT NOT NULL,
    "whoAtRisk" TEXT,
    "initialLikelihood" INTEGER NOT NULL,
    "initialSeverity" INTEGER NOT NULL,
    "initialScore" INTEGER NOT NULL,
    "initialLevel" "RiskLevel" NOT NULL,
    "controlMeasures" TEXT NOT NULL,
    "controlHierarchy" "ControlHierarchy" NOT NULL,
    "requiredPpe" TEXT[],
    "residualLikelihood" INTEGER,
    "residualSeverity" INTEGER,
    "residualScore" INTEGER,
    "residualLevel" "RiskLevel",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "hazard_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_checklists" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "standard" "AuditStandard" NOT NULL,
    "description" TEXT NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "audit_checklists_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "checklist_questions" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "guidanceNote" TEXT,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "checklist_questions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_inspections" (
    "id" TEXT NOT NULL,
    "referenceNo" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "inspectorId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedDate" TIMESTAMP(3),
    "scorePercentage" DECIMAL(5,2),
    "status" "InspectionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "audit_inspections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inspection_responses" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answeredById" UUID NOT NULL,
    "result" "InspectionResult" NOT NULL,
    "findingDescription" TEXT,
    "evidenceUrls" TEXT[],
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inspection_responses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "non_conformance_reports" (
    "id" TEXT NOT NULL,
    "referenceNo" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "raisedById" UUID NOT NULL,
    "severity" "NcrSeverity" NOT NULL,
    "status" "NcrStatus" NOT NULL DEFAULT 'OPEN',
    "summary" TEXT NOT NULL,
    "containmentActions" TEXT,
    "capaTaskId" TEXT,
    "closureNotes" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "non_conformance_reports_pkey" PRIMARY KEY ("id")
);

-- ===== Indexes =====
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_role_idx" ON "users"("role");
CREATE UNIQUE INDEX "sites_code_key" ON "sites"("code");
CREATE INDEX "user_sites_siteId_idx" ON "user_sites"("siteId");
CREATE INDEX "activity_logs_entityType_entityId_createdAt_idx" ON "activity_logs"("entityType", "entityId", "createdAt");
CREATE INDEX "activity_logs_siteId_createdAt_idx" ON "activity_logs"("siteId", "createdAt");
CREATE INDEX "legal_requirements_siteId_category_idx" ON "legal_requirements"("siteId", "category");
CREATE INDEX "legal_requirements_siteId_currentStatus_idx" ON "legal_requirements"("siteId", "currentStatus");
CREATE INDEX "legal_requirements_nextReviewDate_idx" ON "legal_requirements"("nextReviewDate");
CREATE INDEX "compliance_audits_siteId_auditDate_idx" ON "compliance_audits"("siteId", "auditDate");
CREATE INDEX "compliance_audits_requirementId_auditDate_idx" ON "compliance_audits"("requirementId", "auditDate");
CREATE INDEX "compliance_audits_status_idx" ON "compliance_audits"("status");
CREATE UNIQUE INDEX "incidents_referenceNo_key" ON "incidents"("referenceNo");
CREATE INDEX "incidents_siteId_occurredAt_idx" ON "incidents"("siteId", "occurredAt");
CREATE INDEX "incidents_siteId_status_idx" ON "incidents"("siteId", "status");
CREATE INDEX "incidents_severity_idx" ON "incidents"("severity");
CREATE INDEX "incidents_reportedById_idx" ON "incidents"("reportedById");
CREATE UNIQUE INDEX "rca_analyses_incidentId_key" ON "rca_analyses"("incidentId");
CREATE INDEX "rca_analyses_status_idx" ON "rca_analyses"("status");
CREATE UNIQUE INDEX "capa_actions_referenceNo_key" ON "capa_actions"("referenceNo");
CREATE INDEX "capa_actions_siteId_status_idx" ON "capa_actions"("siteId", "status");
CREATE INDEX "capa_actions_assigneeId_status_idx" ON "capa_actions"("assigneeId", "status");
CREATE INDEX "capa_actions_dueDate_status_idx" ON "capa_actions"("dueDate", "status");
CREATE INDEX "capa_actions_incidentId_idx" ON "capa_actions"("incidentId");
CREATE INDEX "capa_actions_auditId_idx" ON "capa_actions"("auditId");
CREATE INDEX "capa_actions_inspectionId_idx" ON "capa_actions"("inspectionId");
CREATE INDEX "capa_escalations_capaId_createdAt_idx" ON "capa_escalations"("capaId", "createdAt");
CREATE INDEX "capa_escalations_toUserId_idx" ON "capa_escalations"("toUserId");
CREATE UNIQUE INDEX "escalation_rules_siteId_priority_level_key" ON "escalation_rules"("siteId", "priority", "level");
CREATE UNIQUE INDEX "waste_manifests_manifestCode_key" ON "waste_manifests"("manifestCode");
CREATE INDEX "waste_manifests_siteId_status_idx" ON "waste_manifests"("siteId", "status");
CREATE INDEX "waste_manifests_siteId_dispatchedAt_idx" ON "waste_manifests"("siteId", "dispatchedAt");
CREATE INDEX "waste_manifests_siteId_wasteType_idx" ON "waste_manifests"("siteId", "wasteType");
CREATE UNIQUE INDEX "weighbridge_tickets_manifestId_key" ON "weighbridge_tickets"("manifestId");
CREATE UNIQUE INDEX "weighbridge_tickets_siteId_weighbridgeTicketNo_key" ON "weighbridge_tickets"("siteId", "weighbridgeTicketNo");
CREATE INDEX "weighbridge_tickets_siteId_dischargeDate_idx" ON "weighbridge_tickets"("siteId", "dischargeDate");
CREATE INDEX "weighbridge_tickets_siteId_wasteType_dischargeDate_idx" ON "weighbridge_tickets"("siteId", "wasteType", "dischargeDate");
CREATE INDEX "weighbridge_tickets_siteId_countedToLandfill_dischargeDate_idx" ON "weighbridge_tickets"("siteId", "countedToLandfill", "dischargeDate");
CREATE INDEX "discharge_logs_siteId_medium_sampledAt_idx" ON "discharge_logs"("siteId", "medium", "sampledAt");
CREATE INDEX "discharge_logs_siteId_parameter_sampledAt_idx" ON "discharge_logs"("siteId", "parameter", "sampledAt");
CREATE INDEX "discharge_logs_isExceedance_idx" ON "discharge_logs"("isExceedance");
CREATE UNIQUE INDEX "landfill_capacities_siteId_key" ON "landfill_capacities"("siteId");
CREATE UNIQUE INDEX "risk_assessments_referenceNo_version_key" ON "risk_assessments"("referenceNo", "version");
CREATE INDEX "risk_assessments_siteId_status_idx" ON "risk_assessments"("siteId", "status");
CREATE INDEX "risk_assessments_nextReviewDate_idx" ON "risk_assessments"("nextReviewDate");
CREATE INDEX "hazard_items_riskAssessmentId_sortOrder_idx" ON "hazard_items"("riskAssessmentId", "sortOrder");
CREATE INDEX "hazard_items_initialLevel_idx" ON "hazard_items"("initialLevel");
CREATE INDEX "hazard_items_residualLevel_idx" ON "hazard_items"("residualLevel");
CREATE INDEX "audit_checklists_standard_idx" ON "audit_checklists"("standard");
CREATE INDEX "checklist_questions_checklistId_sortOrder_idx" ON "checklist_questions"("checklistId", "sortOrder");
CREATE UNIQUE INDEX "audit_inspections_referenceNo_key" ON "audit_inspections"("referenceNo");
CREATE INDEX "audit_inspections_siteId_status_idx" ON "audit_inspections"("siteId", "status");
CREATE INDEX "audit_inspections_siteId_scheduledDate_idx" ON "audit_inspections"("siteId", "scheduledDate");
CREATE INDEX "audit_inspections_inspectorId_status_idx" ON "audit_inspections"("inspectorId", "status");
CREATE UNIQUE INDEX "inspection_responses_inspectionId_questionId_key" ON "inspection_responses"("inspectionId", "questionId");
CREATE UNIQUE INDEX "non_conformance_reports_referenceNo_key" ON "non_conformance_reports"("referenceNo");
CREATE UNIQUE INDEX "non_conformance_reports_responseId_key" ON "non_conformance_reports"("responseId");
CREATE INDEX "non_conformance_reports_siteId_status_idx" ON "non_conformance_reports"("siteId", "status");
CREATE INDEX "non_conformance_reports_inspectionId_idx" ON "non_conformance_reports"("inspectionId");
CREATE INDEX "non_conformance_reports_capaTaskId_idx" ON "non_conformance_reports"("capaTaskId");

-- ===== Foreign keys =====
ALTER TABLE "user_sites" ADD CONSTRAINT "user_sites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_sites" ADD CONSTRAINT "user_sites_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "legal_requirements" ADD CONSTRAINT "legal_requirements_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "legal_requirements" ADD CONSTRAINT "legal_requirements_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "compliance_audits" ADD CONSTRAINT "compliance_audits_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "compliance_audits" ADD CONSTRAINT "compliance_audits_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "legal_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "compliance_audits" ADD CONSTRAINT "compliance_audits_auditorId_fkey" FOREIGN KEY ("auditorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rca_analyses" ADD CONSTRAINT "rca_analyses_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rca_analyses" ADD CONSTRAINT "rca_analyses_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rca_analyses" ADD CONSTRAINT "rca_analyses_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "capa_actions" ADD CONSTRAINT "capa_actions_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "capa_actions" ADD CONSTRAINT "capa_actions_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "capa_actions" ADD CONSTRAINT "capa_actions_rcaId_fkey" FOREIGN KEY ("rcaId") REFERENCES "rca_analyses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "capa_actions" ADD CONSTRAINT "capa_actions_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "compliance_audits"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "capa_actions" ADD CONSTRAINT "capa_actions_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "audit_inspections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "capa_actions" ADD CONSTRAINT "capa_actions_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "capa_actions" ADD CONSTRAINT "capa_actions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "capa_actions" ADD CONSTRAINT "capa_actions_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "capa_actions" ADD CONSTRAINT "capa_actions_escalatedToId_fkey" FOREIGN KEY ("escalatedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "capa_escalations" ADD CONSTRAINT "capa_escalations_capaId_fkey" FOREIGN KEY ("capaId") REFERENCES "capa_actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "capa_escalations" ADD CONSTRAINT "capa_escalations_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "escalation_rules" ADD CONSTRAINT "escalation_rules_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "waste_manifests" ADD CONSTRAINT "waste_manifests_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "waste_manifests" ADD CONSTRAINT "waste_manifests_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "weighbridge_tickets" ADD CONSTRAINT "weighbridge_tickets_manifestId_fkey" FOREIGN KEY ("manifestId") REFERENCES "waste_manifests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "weighbridge_tickets" ADD CONSTRAINT "weighbridge_tickets_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "weighbridge_tickets" ADD CONSTRAINT "weighbridge_tickets_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "discharge_logs" ADD CONSTRAINT "discharge_logs_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "discharge_logs" ADD CONSTRAINT "discharge_logs_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "legal_requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "discharge_logs" ADD CONSTRAINT "discharge_logs_sampledById_fkey" FOREIGN KEY ("sampledById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "landfill_capacities" ADD CONSTRAINT "landfill_capacities_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_assessorId_fkey" FOREIGN KEY ("assessorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "risk_assessments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "hazard_items" ADD CONSTRAINT "hazard_items_riskAssessmentId_fkey" FOREIGN KEY ("riskAssessmentId") REFERENCES "risk_assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hazard_items" ADD CONSTRAINT "hazard_items_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "hazard_items" ADD CONSTRAINT "hazard_items_capaActionId_fkey" FOREIGN KEY ("capaActionId") REFERENCES "capa_actions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_checklists" ADD CONSTRAINT "audit_checklists_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checklist_questions" ADD CONSTRAINT "checklist_questions_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "audit_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_inspections" ADD CONSTRAINT "audit_inspections_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_inspections" ADD CONSTRAINT "audit_inspections_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "audit_checklists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_inspections" ADD CONSTRAINT "audit_inspections_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_inspections" ADD CONSTRAINT "audit_inspections_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inspection_responses" ADD CONSTRAINT "inspection_responses_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "audit_inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inspection_responses" ADD CONSTRAINT "inspection_responses_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "checklist_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inspection_responses" ADD CONSTRAINT "inspection_responses_answeredById_fkey" FOREIGN KEY ("answeredById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "non_conformance_reports" ADD CONSTRAINT "non_conformance_reports_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "non_conformance_reports" ADD CONSTRAINT "non_conformance_reports_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "audit_inspections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "non_conformance_reports" ADD CONSTRAINT "non_conformance_reports_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "inspection_responses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "non_conformance_reports" ADD CONSTRAINT "non_conformance_reports_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "non_conformance_reports" ADD CONSTRAINT "non_conformance_reports_capaTaskId_fkey" FOREIGN KEY ("capaTaskId") REFERENCES "capa_actions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ===== Extra constraints (from prisma/constraints.sql) =====
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

-- Per-user module access (same as prisma/user-modules.sql)
CREATE TABLE IF NOT EXISTS "user_modules" (
    "userId" UUID NOT NULL,
    "module" TEXT NOT NULL,
    CONSTRAINT "user_modules_pkey" PRIMARY KEY ("userId", "module"),
    CONSTRAINT "user_modules_module_check" CHECK ("module" IN ('compliance', 'incidents', 'waste', 'risk', 'audits', 'permits', 'training', 'contractors', 'documents', 'drills')),
    CONSTRAINT "user_modules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
ALTER TABLE "user_modules" ENABLE ROW LEVEL SECURITY;

-- Permits to work
CREATE TABLE IF NOT EXISTS "work_permits" (
    "id" TEXT NOT NULL,
    "permitCode" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "requestedById" UUID NOT NULL,
    "approvedById" UUID,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "title" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "hazards" TEXT NOT NULL,
    "precautions" TEXT NOT NULL,
    "workers" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "statusNote" TEXT,
    "closeoutNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "work_permits_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "work_permits_type_check" CHECK ("type" IN ('HOT_WORK','CONFINED_SPACE','WORK_AT_HEIGHT','ELECTRICAL','EXCAVATION','OTHER')),
    CONSTRAINT "work_permits_status_check" CHECK ("status" IN ('REQUESTED','APPROVED','IN_PROGRESS','CLOSED','REJECTED','CANCELLED')),
    CONSTRAINT "work_permits_window_check" CHECK ("validTo" > "validFrom"),
    CONSTRAINT "work_permits_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "work_permits_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "work_permits_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "work_permits_permitCode_key" ON "work_permits"("permitCode");
CREATE INDEX IF NOT EXISTS "work_permits_siteId_status_idx" ON "work_permits"("siteId", "status");
CREATE INDEX IF NOT EXISTS "work_permits_siteId_validTo_idx" ON "work_permits"("siteId", "validTo");
ALTER TABLE "work_permits" ENABLE ROW LEVEL SECURITY;


COMMIT;
