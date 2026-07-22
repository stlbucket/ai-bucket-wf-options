-- pgTAP test harness teardown — run once after the suite by scripts/db-test.ts.
-- Drops the `test` helper schema; leaves the `tap` extension installed (fast re-runs).
drop schema if exists test cascade;
