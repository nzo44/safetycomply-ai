# SafetyComply AI

Industrial HSE (health, safety, environment) platform for plant managers, environmental officers and compliance auditors.

**Stack:** Next.js 14 (App Router), React, TypeScript, Tailwind CSS, Lucide, Recharts, Prisma, PostgreSQL, Supabase Auth.

## Modules

| # | Module | Scope | Status in this repo |
|---|---|---|---|
| 1 | Legal compliance matrix | Requirements, audits, gap analysis, filter bar, audit drawer | To be added |
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
npx prisma migrate dev          # once prisma/schema.prisma is added
npm run dev
```

## Conventions

- Server Actions live in `src/actions/<domain>/`, read queries in `src/lib/data/`, Zod schemas in `src/lib/validations/`.
- Every action calls `authorize(permission, siteId)` before touching data. The site always comes from the record, never from client input.
- Status changes are guarded `updateMany` calls inside a transaction, and each one writes to the activity log.
- Statuses such as "overdue" are derived from dates, never stored.
- Evidence is stored as `http(s)` references only.
