-- RentManager – šema baze za Supabase
-- Pokrenuti jednom u Supabase SQL Editoru (ili `supabase db push`).
--
-- Model:
--   agencies        – jedna rent-a-car agencija (podešavanja u jsonb)
--   agency_members  – korisnici agencije i njihova uloga (owner = vlasnik, staff = radnik)
--   agency_invites  – pozivnice po email adresi; prihvataju se automatski pri prijavi
--   records         – vozila, klijenti, izdavanja i troškovi (jsonb dokumenti po vrsti)
--
-- Sigurnost: Row Level Security – korisnik vidi i mijenja samo podatke svoje agencije.

create extension if not exists pgcrypto;

create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create table public.agency_members (
  agency_id uuid not null references public.agencies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'staff')),
  email text,
  created_at timestamptz not null default now(),
  primary key (agency_id, user_id)
);
create index agency_members_user_idx on public.agency_members (user_id);

create table public.agency_invites (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  email text not null,
  role text not null default 'staff' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  unique (agency_id, email)
);
create index agency_invites_email_idx on public.agency_invites (lower(email));

create table public.records (
  id uuid primary key,
  agency_id uuid not null references public.agencies (id) on delete cascade,
  kind text not null check (kind in ('vehicles', 'customers', 'rentals', 'expenses')),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
create index records_agency_kind_idx on public.records (agency_id, kind);
-- Potrebno da realtime šalje kompletan red i pri brisanju
alter table public.records replica identity full;

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

create trigger records_touch before insert or update on public.records
  for each row execute function public.touch_updated_at();

-- ---------- Pomoćne funkcije (security definer da se izbjegne rekurzija u RLS) ----------

create or replace function public.is_member(a uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from agency_members where agency_id = a and user_id = auth.uid());
$$;

create or replace function public.is_owner(a uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from agency_members where agency_id = a and user_id = auth.uid() and role = 'owner');
$$;

-- Kreira agenciju i postavlja trenutnog korisnika kao vlasnika
create or replace function public.create_agency(agency_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Niste prijavljeni';
  end if;
  insert into agencies (name, created_by) values (agency_name, auth.uid()) returning id into new_id;
  insert into agency_members (agency_id, user_id, role, email)
    values (new_id, auth.uid(), 'owner', auth.jwt() ->> 'email');
  return new_id;
end $$;

-- Prihvata sve pozivnice za email prijavljenog korisnika; vraća broj prihvaćenih
create or replace function public.accept_invites() returns integer
language plpgsql security definer set search_path = public as $$
declare
  user_email text := lower(auth.jwt() ->> 'email');
  n integer := 0;
  inv record;
begin
  if auth.uid() is null or user_email is null then
    return 0;
  end if;
  for inv in select * from agency_invites where lower(email) = user_email loop
    insert into agency_members (agency_id, user_id, role, email)
      values (inv.agency_id, auth.uid(), inv.role, user_email)
      on conflict (agency_id, user_id) do nothing;
    delete from agency_invites where id = inv.id;
    n := n + 1;
  end loop;
  return n;
end $$;

-- Vlasnik ne može ukloniti posljednjeg vlasnika agencije
create or replace function public.protect_last_owner() returns trigger
language plpgsql as $$
begin
  -- Brisanje cijele agencije (kaskadno) je dozvoljeno
  if not exists (select 1 from agencies where id = old.agency_id) then
    return coalesce(new, old);
  end if;
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner') then
    if not exists (
      select 1 from agency_members
      where agency_id = old.agency_id and role = 'owner' and user_id <> old.user_id
    ) then
      raise exception 'Agencija mora imati bar jednog vlasnika';
    end if;
  end if;
  return coalesce(new, old);
end $$;

create trigger agency_members_last_owner before update or delete on public.agency_members
  for each row execute function public.protect_last_owner();

-- ---------- Row Level Security ----------

alter table public.agencies enable row level security;
alter table public.agency_members enable row level security;
alter table public.agency_invites enable row level security;
alter table public.records enable row level security;

create policy agencies_select on public.agencies for select using (public.is_member(id));
create policy agencies_update on public.agencies for update using (public.is_owner(id)) with check (public.is_owner(id));
create policy agencies_delete on public.agencies for delete using (public.is_owner(id));
-- insert ide isključivo preko create_agency()

create policy members_select on public.agency_members for select using (public.is_member(agency_id));
create policy members_update on public.agency_members for update using (public.is_owner(agency_id)) with check (public.is_owner(agency_id));
-- vlasnik uklanja članove; svako može napustiti agenciju
create policy members_delete on public.agency_members for delete using (public.is_owner(agency_id) or user_id = auth.uid());

create policy invites_select on public.agency_invites for select using (public.is_owner(agency_id));
create policy invites_insert on public.agency_invites for insert with check (public.is_owner(agency_id));
create policy invites_delete on public.agency_invites for delete using (public.is_owner(agency_id));

create policy records_select on public.records for select using (public.is_member(agency_id));
create policy records_insert on public.records for insert with check (public.is_member(agency_id));
create policy records_update on public.records for update using (public.is_member(agency_id)) with check (public.is_member(agency_id));
create policy records_delete on public.records for delete using (public.is_member(agency_id));

grant execute on function public.create_agency(text) to authenticated;
grant execute on function public.accept_invites() to authenticated;

-- ---------- Realtime (promjene se odmah vide na svim uređajima) ----------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.records;
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.agencies;
  end if;
end $$;
