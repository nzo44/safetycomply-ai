# SafetyComply AI

Industrial HSE (health, safety, environment) platform for plant managers, environmental officers and compliance auditors.

**Stack:** Next.js 14 (App Router), React, TypeScript, Tailwind CSS, Lucide, Recharts, Prisma, PostgreSQL, Supabase Auth.

## Modules

| # | Module | Scope | Status in this repo |
|---|---|---|---|
| 1 | Legal compliance matrix | Requirements, audits, gap analysis, filter bar, audit drawer | Added (stage 2) |
| 2 | Incidents, RCA and CAPA | Incident register, 5-Whys, CAPA board, escalation sweep | To be added |
| 3 | Waste and discharge | Manifests, weighbridge tickets, landfill capacity | To be added |
| 4 | Risk assessments | JSA/HIRA 5x5 matrix, versioning, print-to-PDF | To be added |
| 5 | Audits and inspections | Checklists, execution drawer, NCRs linked to CAPA | To be added |
| - | Shared | Supabase Storage signed URLs and toast notifications | Planned |

## Getting started

```bash
npm install
cp .env.example .env.local      # fill in your Supabase values
npx prisma validate
npx prisma migrate dev --create-only --name init
#   append prisma/constraints.sql to the generated migration.sql, then:
npx prisma migrate dev
#   run prisma/supabase-auth-trigger.sql once in the Supabase SQL editor
npm run dev
```

## Database

- `prisma/schema.prisma`: all models for Modules 1 to 5 (23 models, 27 enums).
- `prisma/constraints.sql`: CHECK constraints and partial unique indexes Prisma can't express (weighbridge arithmetic, 5x5 risk scores, one approved risk-assessment version, CAPA origin).
- `prisma/supabase-auth-trigger.sql`: copies new Supabase Auth users into `users`, plus bootstrap statements for a first site and admin.

## Foundation (stage 1)

Shared code every module builds on: `src/lib/auth` (session, RBAC matrix, `authorize()` guard), `src/lib/action-result.ts`, `src/lib/reference.ts` (atomic reference numbers), `src/lib/activity.ts` (audit trail), `src/lib/utils.ts` (timezone-aware dates), `src/lib/validations/helpers.ts`, `src/lib/data/params.ts`, Supabase clients and middleware.

## Conventions

- Server Actions live in `src/actions/<domain>/`, read queries in `src/lib/data/`, Zod schemas in `src/lib/validations/`.
- Every action calls `authorize(permission, siteId)` before touching data. The site always comes from the record, never from client input.
- Status changes are guarded `updateMany` calls inside a transaction, and each one writes to the activity log.
- Statuses such as "overdue" are derived from dates, never stored.
- Evidence is stored as `http(s)` references only.

## Shared UI (stage 2)

`src/components/ui`: `Field`/`SubmitButton`, `ActionPanel` (config-driven workflow forms), `UrlFilters` (URL-driven search and filters), `Drawer` (URL-driven right-hand drawer on native `<dialog>`), `Pagination`. The dashboard shell is `src/app/(dashboard)/layout.tsx`.
