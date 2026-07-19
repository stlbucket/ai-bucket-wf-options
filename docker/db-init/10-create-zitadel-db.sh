#!/bin/sh
# Fresh-volume init: dedicated `zitadel` database + login role inside the shared
# postgis container. Runs from /docker-entrypoint-initdb.d ONLY when the db-data
# volume is brand new (a rebuild wipes volumes, so every rebuild re-runs this).
# ZITADEL's own `init` phase (start-from-init + admin creds) would also create
# these — this script just makes the database's existence independent of ZITADEL
# boot ordering and keeps the fnb database untouched by it.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
	create role zitadel login password '${ZITADEL_DB_PASSWORD}';
	create database zitadel owner zitadel;
EOSQL
