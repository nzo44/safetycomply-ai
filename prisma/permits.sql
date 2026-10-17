-- Run once in the Supabase SQL Editor BEFORE deploying the permits-to-work feature. Safe to run twice.

ALTER TYPE "ActivityEntity" ADD VALUE IF NOT EXISTS 'PERMIT';

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

-- Let per-user module access name the new module.
ALTER TABLE "user_modules" DROP CONSTRAINT IF EXISTS "user_modules_module_check";
ALTER TABLE "user_modules" ADD CONSTRAINT "user_modules_module_check"
    CHECK ("module" IN ('compliance','incidents','waste','risk','audits','permits','training','contractors','documents','drills'));
