# Dev-only Postgres image: PostGIS + pgTAP.
# pgTAP is the DB unit-test framework (spec .claude/specs/db-testing/). Only the OS package is
# installed here; the EXTENSION itself is created on demand by scripts/db-test.ts (its setup runs
# `CREATE EXTENSION IF NOT EXISTS pgtap SCHEMA tap`), so pgTAP's ~1000 functions never exist in the
# DB unless you actually run the DB tests. Production uses MANAGED Postgres
# (infra/compose/docker-compose.prod.yml) and never builds this image — pgTAP stays out of prod.
FROM postgis/postgis
# PG_MAJOR is set by the base postgres image → install the matching pgtap package for this major.
RUN apt-get update \
 && apt-get install -y --no-install-recommends "postgresql-${PG_MAJOR}-pgtap" \
 && rm -rf /var/lib/apt/lists/*
