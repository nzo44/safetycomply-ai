-- Run once in the Supabase SQL editor.
--
-- Creates the private bucket for evidence files. It is NOT public, and no storage policies are added:
-- with row level security on storage.objects and no policies, only the service-role key can read or
-- write. The app does all access from the server: it hands the browser a one-time signed upload token,
-- and opens files through /api/evidence, which checks site access and redirects to a 60-second signed URL.
--
-- The size and type limits below are enforced by Supabase itself, in addition to the app's own checks.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evidence', 'evidence', false, 10485760,
  array[
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain', 'text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
