# ops-cli / users-snapshot — export & restore of tenants, users, residencies, licenses

> **Execution Directive:** plan + build this spec via `/fnb-stack-implementor
> .claude/specs/ops-cli/users-snapshot/README.md` — the implementor derives the
> `.claude/issues/` plan file (R23) from the task list below, then executes it.

## Status
Draft — approved for implementation (no `[FILL IN]`s outstanding).

## Purpose

The demo server (a DigitalOcean droplet) will accumulate real, unknown users — profiles,
tenants/child-tenants, residencies, and licenses we cannot recreate from seed data. When the
demo env is rebuilt, that identity/membership data must survive. This spec defines a **CLI
snapshot utility** run over SSH on the droplet (or locally against dev):

- `export` — dump the six identity/membership tables to a versioned JSON file
- `import` — restore that file into a target DB in one transaction, upserting by original UUID

**Deliberately not a UI feature.** No site-admin page, no GraphQL operation, no deployed DB
function. The import logic lives entirely in the script as generated SQL run as the DB
superuser — nothing ships on the public API surface of the very box that has unknown users on
it, and nothing has to be ripped back out of sqitch later.

This is the first member of a `scripts/ops/` family — one-off operational utilities run
directly (SSH/local), never baked into the pipeline.

Scope is identity + membership only: no messages, todos, polls, games, assets, notifications,
or support tickets.

## Locked decisions

| Decision | Choice | Why |
|---|---|---|
| Tool shape | CLI-only (`scripts/ops/users-snapshot.ts`), no site-admin page | An "upsert everything" mutation on the public GraphQL endpoint of a box with unknown users is a real attack surface for a throwaway; SSH exposes nothing. User confirmed 2026-07-23. |
| Throwaway DB function | **None** — import is script-generated SQL in one transaction | Superuser connection bypasses RLS; nothing to deploy or later revert from sqitch. |
| Transport | `docker run --rm -i --network fnb-network postgres:18 psql ${PG_URL}` (the `scripts/db-exec.ts` pattern), `PG_URL` from `.env` via `scripts/_env.ts` | Proven pattern that works identically on dev and the droplet; no new Node deps, no host-published port required. |
| Snapshot set | `app.tenant`, `app.profile`, `app.tenant_subscription`, `app.resident`, `app.license` (+ `res.resource` registration on import) | `license.tenant_subscription_id` is NOT NULL — subscriptions must ride along. `license_pack`/`license_type` are seeded config referenced by key, not snapshotted. |
| `idp_user_id` | Exported and restored | The ZITADEL `sub` mapping; ZITADEL is a separate store, so restoring it keeps logins linked instantly (email re-adoption via `app_fn.provision_idp_user` is only the fallback). |
| Upsert semantics | `INSERT … ON CONFLICT (id) DO UPDATE`, original UUIDs preserved | FKs (including cross-table and `parent_tenant_id`) hold without remapping. |
| Secondary-unique collisions | **Fail loudly** (transaction aborts) | A profile/tenant on the target with the same `email`/`identifier`/`display_name` but a different id is a real conflict a human must resolve — silent adoption hides it. |
| Restore target | A **virgin** env (`env-rebuild-empty`, `/auth/setup` NOT run) | Import preamble calls idempotent `app_fn.install_anchor_application()` to seed packs/types, then restores the snapshot's own anchor tenant verbatim. On an already-bootstrapped target the anchor's unique `identifier='anchor'` collides → loud abort (correct: two anchors must never coexist). |
| URN registry | Import calls `res_fn.register_resource` per tenant and per resident | Those rows are deny-all and only written by the SECURITY DEFINER fn; it is idempotent (`ON CONFLICT DO NOTHING`). |
| Dry-run | `import --dry-run` runs the full transaction then `ROLLBACK` | Free correctness check on any env, including upserting a snapshot onto its own source. |
| Invocation | `pnpm ops:users-snapshot export --out <file>` / `import --file <file> [--dry-run]` | Root `package.json` script → `tsx scripts/ops/users-snapshot.ts`, matching every other host-side script. |

## Files in this spec

| File | Contents |
|---|---|
| `README.md` | This index — decisions, task list |
| `users-snapshot.data.md` | Full contract: CLI surface, JSON envelope, per-table column lists, export queries, import algorithm + ordering, failure modes |

No `.ui.md` — there is no page (R18 governs pages; this is a host-side script).

## Implementation Task List

### Phase 1 — scaffolding
- [ ] `scripts/ops/users-snapshot.ts` (tsx, imports `PG_URL`/`REPO_ROOT` from `../_env`)
- [ ] Root `package.json` script: `"ops:users-snapshot": "tsx scripts/ops/users-snapshot.ts"`

### Phase 2 — export
- [ ] `export --out <file>`: single psql call producing one JSON document (envelope per
      `users-snapshot.data.md`), written to `<file>`; print per-table counts on success

### Phase 3 — import
- [ ] `import --file <file> [--dry-run]`: validate envelope version + counts, generate the
      transaction SQL (preamble → ordered upserts → `res_fn.register_resource` calls →
      count assertions), execute via the docker psql pattern with `ON_ERROR_STOP=1`
- [ ] `--dry-run` emits `ROLLBACK` instead of `COMMIT`

### Phase 4 — verification (no env rebuilds — house rule)
- [ ] Export from the local dev env; assert envelope shape + non-zero counts
- [ ] `import --dry-run` of that same file back onto the dev env (self-upsert must succeed
      with all rows reported as updates)
- [ ] The real restore drill (virgin env → import → login via ZITADEL) is **user-executed**
      on the droplet; document the exact command sequence in the script's `--help`

## Remaining Open Questions
- None blocking. Deferred: whether later `scripts/ops/` members warrant a tiny shared runner
  helper — decide when the second tool appears, not now.

## Considered & rejected

- **Site-admin "Database Tools" page** (original idea) — download/upload buttons backed by a
  `p:app-admin-super`-gated GraphQL mutation. Rejected: publishes an upsert-everything
  mutation on the demo box's public endpoint, requires a throwaway `_fn` function deployed
  and later reworked out of sqitch, and adds browser file plumbing for a file that lives on
  the server anyway. User chose CLI-only 2026-07-23.
- **Node `pg` client instead of docker psql** — needs a host-published Postgres port and a new
  root dependency; the docker pattern already works on both dev and droplet.
- **Partial `pg_dump --table`** — dumps can't express the anchor preamble, URN registration,
  or upsert-onto-existing semantics; plain COPY conflicts on re-import.
- **Silent adoption on email collision** (update the existing row that owns the email) —
  hides genuine identity conflicts; fail-loud chosen instead.
