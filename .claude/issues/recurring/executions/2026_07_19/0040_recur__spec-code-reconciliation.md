# Execution log — 0040_recur__spec-code-reconciliation — 2026-07-19

## Fixed inline (canonical files)

1. **`monorepo-bootstrap-pattern.md`** — two drifts: removed the deleted `db-generate` script
   from the root-scripts listing; rewrote the `DEPLOY_PACKAGES` bullet to the true 11-package
   list (was the old 9-package list still carrying retired `fnb-wf`, missing
   `fnb-agent`/`fnb-n8n`/`fnb-res`; ordering constraint corrected to "`fnb-agent` precedes
   fnb-storage/fnb-location-datasets/fnb-airports"); dropped the `db/db-config.ts` mention
   (file deleted in the 0010 leg).
2. **`package-layers-pattern.md`** — auth-server section: removed the deleted `src/ping.ts`
   line; replaced the stale "Used by: worker-app (graphile-worker…)" with the truth (zero
   consumers, retirement candidate → 0350).
3. **`architecture-considerations/read-these/g1-sqitch-deployment-order.md`** — deploy tree
   modernized: `jwt.*` helpers not `auth.*`, `auth.user` drop noted, retired
   `fnb-wf`/`fnb-my-app` removed, `fnb-agent → fnb-n8n → fnb-res` + the six module packages
   added, `.env` `DEPLOY_PACKAGES` named as the authoritative order.
4. **`auth-app/current-profile-claims.data.md`** — `ping` removed from the page list.
5. **`msg-app/index.data.md`** — re-export snippet updated (no more `type TopicSummary`).
6. **`asset-storage/README.md` + `tenant-app/datasets/breweries/README.md`** — `db/db-config.ts`
   registration mentions annotated as removed (`.env` is the single deploy list).
7. **`CLAUDE.md`** — "`db/my-app` is cruft" sentence removed (the directory is gone).
8. **Todo specs trued up** — `tenant-app/tools/todo/index.{ui,data}.md` +
   `tools/_shared.data.md` still said `Draft — fill in all [FILL IN]` with zero actual markers
   and a fully implemented GraphQL module behind them → status flipped to Implemented.
9. **Code fix ridden along**: `apps/auth-app/package.json` dropped the stale
   `@function-bucket/fnb-auth-server` dep (its last import was the ping scaffolding removed in
   the 0010 leg).

## Checklist results

- **Pattern files vs code** — drift found + fixed as above; `graphql-api-pattern.md` and
  `sockets-pattern.md` spot-checked clean (2-arg `withClaims`, localStorage claims, no
  `export *` of the generated module).
- **global-rules R1–R24** — no rule contradicts code or another rule; no edits needed.
- **Per-page specs (R18–R20)** — full pages-vs-specs diff for tenant-app: one real gap
  (`loc/new` has no spec pair) → spawned 0360. `site-admin/wf-agentic` + `wf-n8n` pages are
  specced in `.claude/specs/n8n-parallel-engine/` (organizational, not a gap). No stray
  `[FILL IN]` markers anywhere in authoritative specs (all remaining grep hits are the
  convention being *described*). `n8n-workflow-engine/` is properly tombstoned as superseded.
- **R21 single-description invariant** — no new inline stack re-descriptions found in specs.

## Spawned identified/ items

- `0350__infra_____retire-auth-server-package______LOW__.plan.md` — auth-server package has
  zero consumers; retirement needs a user decision (roster + compose healthcheck touch).
- `0360__specs_____loc-new-page-spec-gap___________LOW__.plan.md` — missing `loc/new` spec
  pair + two module-README backfills.

## Gate

`pnpm install` clean; `pnpm build` — **green** (12/12).
