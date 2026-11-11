-- RentManager – administratorski pregled platforme
-- Administrator platforme (vlasnik aplikacije) vidi sve agencije, korisnike i podatke
-- – samo za čitanje. Obični korisnici i dalje vide samo svoju agenciju.
--
-- Administratora dodajete ručno u SQL Editoru:
--   insert into public.platform_admins (user_id)
--   select id from auth.users where email = 'vas@email.com';

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
-- RLS bez ijedne politike: tabela nije dostupna preko API-ja, samo kroz funkcije ispod
alter table public.platform_admins enable row level security;

create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_admins where user_id = auth.uid());
$$;

create or replace function public.assert_platform_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from platform_admins where user_id = auth.uid()) then
    raise exception 'Nemate administratorski pristup' using errcode = '42501';
  end if;
end $$;

-- Sve agencije
create or replace function public.admin_agencies()
returns table (id uuid, name text, settings jsonb, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform assert_platform_admin();
  return query select a.id, a.name, a.settings, a.created_at from agencies a order by a.created_at;
end $$;

-- Svi registrovani korisnici i njihova članstva
create or replace function public.admin_users()
returns table (
  user_id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed boolean,
  agency_id uuid,
  role text
)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  perform assert_platform_admin();
  return query
    select u.id, u.email::text, u.created_at, u.last_sign_in_at, u.email_confirmed_at is not null,
           m.agency_id, m.role
    from auth.users u
    left join agency_members m on m.user_id = u.id
    order by u.created_at;
end $$;

-- Svi zapisi (vozila, klijenti, izdavanja, troškovi), po stranicama
create or replace function public.admin_records(p_offset integer default 0, p_limit integer default 1000)
returns table (id uuid, agency_id uuid, kind text, data jsonb, updated_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform assert_platform_admin();
  return query
    select r.id, r.agency_id, r.kind, r.data, r.updated_at
    from records r
    order by r.id
    offset greatest(p_offset, 0)
    limit least(greatest(p_limit, 1), 1000);
end $$;

revoke execute on function public.assert_platform_admin() from public, anon;
revoke execute on function public.admin_agencies() from public, anon;
revoke execute on function public.admin_users() from public, anon;
revoke execute on function public.admin_records(integer, integer) from public, anon;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.admin_agencies() to authenticated;
grant execute on function public.admin_users() to authenticated;
grant execute on function public.admin_records(integer, integer) to authenticated;
