# SafetyComply AI

Industrial HSE (health, safety, environment) platform for plant managers, environmental officers and compliance auditors.

**Stack:** Next.js 14 (App Router), React, TypeScript, Tailwind CSS, Lucide, Recharts, Prisma, PostgreSQL, Supabase Auth.

## Modules

| # | Module | Scope | Status in this repo |
|---|---|---|---|
| 1 | Legal compliance matrix | Requirements, audits, gap analysis, filter bar, audit drawer | Added (stage 2) |
| 2 | Incidents, RCA and CAPA | Incident register, 5-Whys, CAPA board, escalation sweep | Added (stage 3) |
| 3 | Waste and discharge | Manifests, weighbridge tickets, landfill capacity | Added (stage 4) |
| 4 | Risk assessments | JSA/HIRA 5x5 matrix, versioning, print-to-PDF | Added (stage 5) |
| 5 | Audits and inspections | Checklists, execution drawer, NCRs linked to CAPA | Added (stage 6) |
| F | Global shell and executive dashboard | Dark sidebar with pending badge, cross-module KPIs, quick actions | Added (stage 7) |
| - | Shared | Supabase Storage signed URLs and toast notifications | Planned (evidence is `http(s)` links until then) |

## Getting started

```bash
npm install
cp .env.example .env            # fill in your Supabase values (Prisma reads .env, not .env.local)
npx prisma validate
npx prisma migrate dev --create-only --name init
#   append prisma/constraints.sql to the generated migration.sql, then:
npx prisma migrate dev
#   then, in the Supabase SQL editor, run in this order:
#     1. prisma/supabase-auth-trigger.sql   (before creating your first user)
#     2. prisma/supabase-rls.sql            (closes the public REST API on every table)
npm run dev
```

Connection strings (Supabase, Connect): `DATABASE_URL` is the transaction pooler (port 6543, with `?pgbouncer=true`) and `DIRECT_URL` is the session pooler (port 5432). Percent-encode special characters in the password (`@` becomes `%40`). Stay on Prisma 6: the datasource block uses `url` and `directUrl`, which Prisma 7 no longer accepts.

## Database

- `prisma/schema.prisma`: all models for Modules 1 to 5 (23 models, 27 enums).
- `prisma/constraints.sql`: CHECK constraints and partial unique indexes Prisma can't express (weighbridge arithmetic, 5x5 risk scores, one approved risk-assessment version, CAPA origin).
- `prisma/supabase-auth-trigger.sql`: copies new Supabase Auth users into `users`, plus bootstrap statements for a first site and admin.
- `prisma/supabase-rls.sql`: enables row level security on every `public` table so the anon key cannot read or write them through Supabase's REST API.

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

## Scheduled jobs

`GET /api/cron/capa-escalation` runs the CAPA escalation sweep (idempotent, safe to run concurrently). Call it daily with `Authorization: Bearer $CRON_SECRET` from Vercel Cron or Supabase `pg_cron` with `pg_net`.

## Routes

`/legal` redirects to `/compliance` and `/risks` redirects to `/risk` (see `next.config.mjs`). The overview lives at `/` in `src/app/(dashboard)/page.tsx`.

## Authentication

Sign-in is by Supabase Auth: email and password, or a one-time email link (existing accounts only; the link flow never creates users). Accounts are created by an administrator in the Supabase dashboard, and `prisma/supabase-auth-trigger.sql` adds the matching `users` row.

In Supabase, add `<NEXT_PUBLIC_SITE_URL>/callback` to Authentication, URL Configuration, Redirect URLs. A signed-in user with no active profile row sees an explanation on `/login` instead of a redirect loop. Users with several sites get a site switcher in the sidebar.
