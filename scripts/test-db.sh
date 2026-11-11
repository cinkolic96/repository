#!/usr/bin/env bash
# Testira SQL migracije i RLS pravila na lokalnom Postgresu (bez Supabase naloga).
# Upotreba: PGHOST=... PGPORT=... PGUSER=postgres scripts/test-db.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB=rentmanager_test
psql -q -c "drop database if exists $DB" -c "create database $DB"
psql -q -d $DB -v ON_ERROR_STOP=1 -f scripts/db-tests/auth_stub.sql 2>&1 | grep -v -i -e wal_level -e "HINT" || true
for f in supabase/migrations/*.sql; do psql -q -d $DB -v ON_ERROR_STOP=1 -f "$f"; done
psql -q -d $DB -c "grant all on all tables in schema public to authenticated;"
psql -q -d $DB -At -f scripts/db-tests/rls_test.sql 2>&1
