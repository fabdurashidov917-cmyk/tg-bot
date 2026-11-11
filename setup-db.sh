#!/bin/bash
# Bir marta ishlatiladi: kinobot bazasi va roli yaratiladi.
set -e
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='kinobot') THEN
    CREATE ROLE kinobot LOGIN PASSWORD 'PAROLNI_OZGARTIRING';
  ELSE
    ALTER ROLE kinobot PASSWORD 'PAROLNI_OZGARTIRING';
  END IF;
END \$\$;
SQL
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='kinobot'" | grep -q 1 || sudo -u postgres createdb -O kinobot kinobot
sudo -u postgres psql -d kinobot -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;" -c "CREATE EXTENSION IF NOT EXISTS unaccent;" -c "GRANT ALL ON SCHEMA public TO kinobot;"
echo "OK: kinobot bazasi tayyor"
