-- Run once in the Supabase SQL editor, BEFORE deploying the module-access feature.
-- Adds per-user module access. A user with no rows here keeps every module their role allows;
-- administrators are never restricted. Safe to run twice.
CREATE TABLE IF NOT EXISTS "user_modules" (
    "userId" UUID NOT NULL,
    "module" TEXT NOT NULL,
    CONSTRAINT "user_modules_pkey" PRIMARY KEY ("userId", "module"),
    CONSTRAINT "user_modules_module_check" CHECK ("module" IN ('compliance', 'incidents', 'waste', 'risk', 'audits')),
    CONSTRAINT "user_modules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
ALTER TABLE "user_modules" ENABLE ROW LEVEL SECURITY;
