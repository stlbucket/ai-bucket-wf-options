# Execution log — 0050_recur__skill-drift-reconciliation — 2026-07-19

## Fixed inline (trivial drift, per this plan's own rules)

1. **`new-db-package/SKILL.md`** — registration step: retired "`fnb-wf` must precede
   `fnb-storage`" replaced with the real ordering constraints (`fnb-agent` precedes
   storage/location-datasets/airports; `fnb-res` precedes registering modules); the
   "do not touch `db/db-config.ts`" sentence updated — the file was removed this run,
   `.env` is the only registration point.
2. **`fnb-db-designer/SKILL.md`** — "Ten sqitch packages" → eleven, with the true
   `DEPLOY_PACKAGES` list (was missing `fnb-agent`/`fnb-n8n`, still had `fnb-wf`); the
   `db/my-app` warning removed (directory deleted this run).
3. **`sqitch-expert/SKILL.md`** — db/ tree rewritten: `fnb-wf` and `my-app` entries removed;
   `fnb-agent`, `fnb-n8n`, `fnb-res` added with their ordering notes.
4. **`function-bucket-legacy-ui-converter/SKILL.md`** — "nine sqitch packages" → eleven with
   the full list; "worker-app — headless graphile-worker runner" → agent-app (R22).

## Checklist results

- **Schema/helper names** — every `jwt.*` helper cited by skills exists in
  `db/fnb-auth` (`uid`, `tenant_id`, `has_permission`, `enforce_permission`,
  `enforce_any_permission`, `has_all_permissions`, …). Apparent misses (`jwt.claims`,
  `jwt.sql`) are grep artifacts of `request.jwt.claims` and the `_jwt.sql` filename.
- **File paths** — all key cited paths resolve (graphile.config.ts,
  trigger-workflow.plugin.ts, agent-harness.ts, with-claims.ts, session.ts, useAppNav.ts,
  app_fn.sql, session.sql, postgraphile.tags.json5, n8n/workflows). The
  `fnb-stack-implementor` claim that packages-watch builds/healthchecks `auth-server` was
  verified against `docker-compose.yml` and is still true — left as-is (retirement is 0350's
  scope).
- **Package/db lists** — corrected as above; the nine-workspace-package roster is current
  (auth-server's roster removal happens only if/when 0350 executes).
- **Version pins** — `@nuxt/ui ^4.6.1` citations match the pnpm catalog.
- **SKILL.md casing** — all uppercase; no case-drift.
- **R21 inline re-description** — nothing new; the fixed lists are reference lists, not stack
  re-descriptions.

## Spawned identified/ items

None — all drift was trivially inline-fixable. (Pre-existing skill-correction items 0080,
0090, 0100, 0240, 0250, 0270 remain in `identified/` untouched; nothing found here duplicates
them.)

## Gate

`pnpm build` — green (doc-only leg; re-verified after edits).
