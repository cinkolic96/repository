-- Test sigurnosnih pravila (RLS). Pokreće ga scripts/test-db.sh
\set ON_ERROR_STOP 0
insert into auth.users values ('00000000-0000-0000-0000-00000000000a','vlasnik@x.me'),('00000000-0000-0000-0000-00000000000b','Radnik@x.me'),('00000000-0000-0000-0000-00000000000c','strani@x.me');
create or replace function as_user(u text, e text) returns void language sql as $$ select set_config('request.jwt.claim.sub', u, false), set_config('request.jwt.claim.email', e, false) $$;
set role authenticated;
-- vlasnik kreira agenciju
select as_user('00000000-0000-0000-0000-00000000000a','vlasnik@x.me');
select create_agency('Agencija A') as agency \gset
insert into records (id, agency_id, kind, data) values (gen_random_uuid(), :'agency', 'vehicles', '{"make":"VW"}');
insert into agency_invites (agency_id, email) values (:'agency', 'radnik@x.me');
select 'A vidi zapisa:', count(*) from records;
-- stranac
select as_user('00000000-0000-0000-0000-00000000000c','strani@x.me');
select 'C vidi zapisa (0):', count(*) from records;
select 'C vidi agencija (0):', count(*) from agencies;
select 'C vidi pozivnica (0):', count(*) from agency_invites;
insert into records (id, agency_id, kind, data) values (gen_random_uuid(), :'agency', 'vehicles', '{}'); -- mora pasti
update records set data='{"hack":1}'; select 'C izmijenio (0):', count(*) from records where data ? 'hack';
insert into agency_members values (:'agency', '00000000-0000-0000-0000-00000000000c', 'owner'); -- mora pasti
select 'C prihvatio pozivnica (0):', accept_invites();
-- radnik prihvata pozivnicu (email sa velikim slovom)
select as_user('00000000-0000-0000-0000-00000000000b','Radnik@x.me');
select 'B prihvatio (1):', accept_invites();
select 'B vidi zapisa (1):', count(*) from records;
insert into records (id, agency_id, kind, data) values (gen_random_uuid(), :'agency', 'customers', '{"firstName":"Ana"}');
select 'B updated_by ok:', updated_by = auth.uid() from records where kind='customers';
update agencies set name='Hack'; select 'naziv nepromijenjen:', name from agencies;
update agency_members set role='owner' where user_id=auth.uid(); select 'B uloga (staff):', role from agency_members where user_id=auth.uid();
select 'B vidi pozivnice (0):', count(*) from agency_invites;
-- vlasnik ne može ukloniti sebe kao jedinog vlasnika
select as_user('00000000-0000-0000-0000-00000000000a','vlasnik@x.me');
delete from agency_members where user_id=auth.uid();
select 'A još vlasnik:', count(*) from agency_members where role='owner';
-- vlasnik briše agenciju (kaskadno)
delete from agencies where id = :'agency';
reset role;
select 'nakon brisanja agencija/zapisa/clanova:', (select count(*) from agencies), (select count(*) from records), (select count(*) from agency_members);
