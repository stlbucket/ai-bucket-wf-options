# Plan: PostGraphile and graphile-worker connect as the postgres superuser in Docker

> **Execution Directive:** Implement via the `fnb-stack-implementor` skill (docker-compose + config edit).
> Invoke: `/fnb-stack-implementor .claude/issues/identified/superuser-database-url.plan.md`
> Never rebuild/restart Docker yourself — ask the user to run `docker compose down && up`, then verify read-only.

**Severity: HIGH** (defense-in-depth defeated) · Workstream: WS2 (DB security) · Identified: 2026-07-05

## Details

- `apps/graphql-api-app/server/graphile.config.ts:28` falls back to the intended low-privilege
  login role: `postgresql://authenticator:authenticator@localhost:5444/fnb`.
- But `docker-compose.yml:246` overrides it for the running service:
  `DATABASE_URL: postgresql://postgres:1234@function_bucket:5432/fnb` — the **postgres superuser**.
- `apps/graphql-api-app/server/plugins/graphile-worker.ts:5` hardcodes the same superuser fallback
  `postgres:1234@function_bucket:5432`.
- `packages/auth-server/src/use-pg-client.ts:4` also defaults to
  `postgresql://postgres:1234@localhost:5444/fnb` (superuser + trivial password), used by worker
  task handlers.

The architecture's whole trust story (`.claude/specs/architecture-considerations/read-these/
a4-noinherit-explanation.md`) depends on the API connecting as `authenticator` (NOINHERIT), with
PostGraphile issuing `SET ROLE authenticated`/`anon` per operation. `SET ROLE` from a superuser
session still applies RLS for the target role, so RLS is not literally off — but:

## Implication

- Any code path that runs **before** `SET ROLE` (or forgets it) executes as superuser — RLS,
  grants, and NOINHERIT protections all void. `pgSettings.role` comes from
  `grafast.context()`; a bug or misconfiguration there silently becomes god-mode instead of
  permission-denied.
- graphile-worker tasks and `auth-server` handlers run entirely as superuser by default.
- A SQL-injection or SSRF anywhere in the API surface escalates to full-cluster compromise instead
  of being contained by the authenticator sandbox.

## Suggested fix

1. In `docker-compose.yml`, point `graphql-api-app`'s `DATABASE_URL` (and any duplicated env for
   worker) at `postgresql://authenticator:authenticator@function_bucket:5432/fnb`.
2. graphile-worker is the wrinkle: it needs DDL on its own `graphile_worker` schema and write access
   for job tables — `authenticator` (NOINHERIT, minimal grants) is likely insufficient. Introduce a
   dedicated `worker` role (LOGIN, owns `graphile_worker` schema, granted exactly the wf/task grants
   the handlers need — today they write wf rows via `useFnbPgClient`), and give the worker plugin its
   own `WORKER_DATABASE_URL` env distinct from PostGraphile's `DATABASE_URL`.
   Consult the `graphile-worker-expert` skill (references/configuration.md) for the minimum
   privileges the worker requires.
3. Fix the hardcoded fallbacks: `graphile-worker.ts:5` and `auth-server/src/use-pg-client.ts:4`
   should default to non-superuser roles (or better, throw when the env var is missing instead of
   silently using a default credential).
4. New role + grants = one sqitch change in `db/fnb-auth` (where roles live:
   `00000000010210_auth_roles_and_grants.sql`).

## Verification

- After user restarts: `select current_user, session_user` via a GraphQL query exposed in dev
  (or check `pg_stat_activity.usename` for the app's connections) → `authenticator` / worker role,
  not `postgres`.
- Worker still processes jobs (run a workflow from the graphql-api-app UI; check dozzle logs read-only).
- Anonymous GraphQL query still resolves as `anon` under RLS.
