-- Minimalna imitacija Supabase 'auth' šeme za lokalno testiranje migracija
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('email', current_setting('request.jwt.claim.email', true), 'sub', current_setting('request.jwt.claim.sub', true)) $$;
grant usage on schema auth to authenticated;
create publication supabase_realtime;
grant usage on schema public to authenticated;
