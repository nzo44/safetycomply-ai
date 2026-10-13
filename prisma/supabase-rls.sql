-- Run once in the Supabase SQL editor, after the first migration.
--
-- Tables created by Prisma live in the "public" schema, which Supabase exposes through its Data API.
-- Without row level security, anyone holding the public anon key (it ships to the browser) could read
-- or write them over REST. This app talks to the database only through Prisma, which connects as the
-- postgres role and bypasses RLS, so enabling RLS with no policies simply closes the REST door.
--
-- Re-run after adding tables. Alternative: turn the Data API off under Project Settings, API.
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
end $$;
