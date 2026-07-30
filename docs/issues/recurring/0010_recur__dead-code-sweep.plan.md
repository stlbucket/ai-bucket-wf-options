# Plan: Dead code / cruft sweep — dead scripts, my-app, empty dirs, stale volumes/locks, console.logs, stale comments

> **Execution Directive:** Implement via the `fnb-stack-implementor` skill — invoke it on *this*
> plan file. Gate is `pnpm build`. Never run `git`; never rebuild Docker yourself — ask the user,
> then verify read-only.

**Severity: LOW** (individually minor; collectively noise + traps) · Workstream: WS4 · Identified: 2026-07-05

## Details / items to remove

1. **`scripts/db-generate.ts`** — targets the retired `packages/db-types` (Kysely/Kanel):
   `const PKG_ROOT = join(REPO_ROOT, 'packages/db-types')`, runs `pnpm generate` there. That package
   no longer exists → the script crashes. Root `package.json` still wires `"db-generate": "tsx
   scripts/db-generate.ts"`. Remove the script + the root script entry (the real codegen is
   `pnpm graphql-api-generate`).
2. **`db/my-app`** — undeployed template cruft: not in `db/db-config.ts` `dbPackages[]`, deploys with
   `drop schema … cascade`, RLS commented out, references a nonexistent `band` table. Delete, or
   regenerate as a *correct* template (coordinate with `skill-new-db-package-template.plan.md`).
3. **Empty dir `apps/auth-app/server/api/tenants/`** — no files, no `tenants` route. Remove.
4. **`node_modules_wf_app` volume** in `docker-compose.yml` — no `wf-app` service exists. Remove.
5. **Stale per-app `pnpm-lock.yaml` files** under `apps/*/` (root already has the authoritative one)
   still referencing `uploadthing`. Remove (confirm they're not intentionally per-app first).
6. **Deprecated `TopicSummary` alias** — `packages/graphql-client-api/src/composables/useMsgTopics.ts:20-21`
   (`@deprecated use SubscribedTopicSummary`), re-exported by `packages/msg-layer/app/composables/
   useMsgTopics.ts`. Remove the alias + the re-export (coordinate with
   `graphql-client-api-consistency.plan.md`).
7. **`console.log` leftovers in production paths:**
   - `packages/graphql-client-api/src/composables/useMsgTopics.ts:94` — `console.log('rezzies', ...)`
   - `apps/graphql-api-app/server/graphile.config.ts:11` — `console.log('baseURl', baseUrl)` (typo'd label)
   - `apps/graphql-api-app/server/lib/worker-task-handlers/_workflow-handler.ts:26,37,79`
   - `apps/graphql-api-app/server/lib/worker-task-handlers/wf-exerciser/maybe-raise-exception.ts:15`
   - `apps/graphql-api-app/server/api/mutation-hooks/_scheduleUows.ts:30`, `_queueAnonWorkflow.ts:23,26`
   - `packages/auth-server/src/use-pg-client.ts:12` — `console.log('PG CLIENT ERROR:', ...)`
   Replace with a proper logger or remove; keep intentional structured error logging if any.
8. **Stale comment** — `packages/tenant-layer/server/middleware/auth.ts:3-4` says it "keeps the
   readable `auth.user` cookie fresh on every request," but `applyEventClaims` no longer writes any
   cookie (claims moved to localStorage). Fix the comment.
9. **`apps/graphql-api-app/postgraphile.tags.json5`** — 100% commented-out boilerplate (default
   `permission` example). Either add the real smart tags the schema needs or trim to a minimal
   documented stub.
10. **`packages/auth-server/src/ping.ts`** — `ping(msg) => 'pong: ' + msg` scaffolding; confirm
    unused (grep) and remove.

## Implication

None of these is dangerous alone, but dead-code-that-looks-alive (my-app template, deprecated alias,
crashing db-generate script) actively misleads, and console.logs leak internal data to logs
(dozzle exposes them) and add noise. Cleanup reduces the surface future audits must re-triage.

## Suggested fix

Work the list above. For each removal: grep for references first, remove, confirm `pnpm build`
stays green and the app starts (no ESM barrel crash from a removed export — the `TopicSummary`
removal touches the barrel, so verify per the barrel-miss caveat). Batch by area (scripts, docker,
packages, apps). Coordinate items 2, 6, 9 with their dedicated plans to avoid double-work.

## Verification

- `pnpm build` green after each batch.
- `grep -rn "db-generate\|packages/db-types" package.json scripts/` → empty (script + entry gone).
- App boots with no `does not provide an export named 'TopicSummary'` ESM crash.
- No `console.log(` in the listed production files (`grep -rn "console.log" apps/graphql-api-app/server packages/graphql-client-api/src packages/auth-server/src`).
- User restarts Docker; smoke read-only.
