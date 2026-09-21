#!/usr/bin/env bash
# Aplica as migrations num Postgres local (com stub do Supabase) e roda verificações básicas.
# Uso: PGHOST=/tmp PGPORT=5433 PGUSER=postgres scripts/db-local-test.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB="${DB_NAME:-auditor_test}"
export PGHOST="${PGHOST:-/tmp}" PGPORT="${PGPORT:-5433}" PGUSER="${PGUSER:-postgres}"

psql -v ON_ERROR_STOP=1 -d postgres -qc "drop database if exists $DB;" -c "create database $DB;"
psql -v ON_ERROR_STOP=1 -d "$DB" -qf scripts/db-stub-supabase.sql
for f in supabase/migrations/*.sql; do
  case "$f" in *0005_cron*) echo "skip $f (pg_cron não disponível localmente)"; continue;; esac
  echo "apply $f"
  psql -v ON_ERROR_STOP=1 -d "$DB" -qf "$f"
done
if [ -f supabase/tests/checks.sql ]; then
  echo "run supabase/tests/checks.sql"
  psql -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/checks.sql
fi
echo "OK"
