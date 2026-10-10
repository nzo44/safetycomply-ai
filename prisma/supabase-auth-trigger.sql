-- Run once in the Supabase SQL editor, after the first migration.
-- Without it, signed-in users have no row in "users" and getCurrentUser() returns null.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, "fullName", role, "updatedAt")
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
          'INSPECTOR', now());
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- Bootstrap: a first site, and promote yourself (admins see every site)
-- insert into sites (id, code, name, "updatedAt") values ('site_demo', 'PLT-001', 'Constantine Plant', now());
-- update users set role = 'ADMIN' where email = 'you@company.com';
