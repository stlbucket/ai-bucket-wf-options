# Execution log — 0030_recur__rls-permission-audit — 2026-07-19

Audit-only leg (DB fixes need sqitch changes + a redeploy the agent never runs). Full sweep of
`db/*/deploy/*.sql` against the six checklist items.

## Checklist results

1. **RLS enabled on every table** — gap confirmed on `app.module`, `app.tool`,
   `app.app_settings` (created in `00000000010220_app.sql`, never enabled in
   `00000000010250_app_policies.sql`, world-writable via the schema-wide grant). Already
   tracked: `identified/0060__security__rls-gaps-msg-loc-app` — no duplicate spawned.
   All other 30+ tables (incl. `agent.workflow_run`, `n8n.workflow_run`, `res.resource`,
   `airports.*`, `location_datasets.brewery`, `storage.asset`) are RLS-enabled.
   `wh.webhook_request` is a false positive (entire deploy file is commented out).
2. **Every RLS table has ≥1 policy** — one exception: `auth.session` has RLS enabled and zero
   policies. Assessed **intentional deny-all**: the table is reached only via SECURITY DEFINER
   pre-claims functions (`app_fn.claims_for_session` etc.) and the `auth` schema is not in
   PostGraphile's `pgServices.schemas`. No action.
3. **Blanket anon grants** — still present (`grant all on all routines in schema app_fn to
   anon, authenticated, service_role`, and schema-wide table grants). Already tracked:
   `identified/0020__security__fn-schema-grant-bypass` (CRT) — no duplicate spawned.
4. **`_api` mutations gated** — clean. All VOLATILE `_api` functions call
   `jwt.enforce_permission` or `jwt.enforce_any_permission` (storage uses the `_any_` variant —
   a naive grep misses it). airports/location_datasets/res `_api` files have no gates because
   they contain only STABLE SECURITY INVOKER reads where RLS applies (documented inline in
   `res_api`).
5. **SECURITY DEFINER `set search_path = ''`** — still largely unpinned (agent_fn, airports_fn,
   app_fn ×4 files, location_datasets_fn, n8n_fn, storage_fn; only res_fn partially pins).
   Already tracked: `identified/0050__security__security-definer-search-path` (HI).
6. **No superuser connections** — `.env:14` still has
   `DATABASE_URL=postgresql://postgres:1234@…`. Already tracked:
   `identified/0040__security__superuser-database-url` (HI).

## Fixed inline

- `identified/0060__security__rls-gaps-msg-loc-app…` updated with a scope-narrowing note:
  findings 1–2 (msg_tenant copy-paste bug, loc shadow tables) are obsolete — the URN-registry
  migration removed all mirror tables; finding 3 (app.module/tool/app_settings) re-verified
  as still real.

## Spawned identified/ items

None — every real gap is already tracked (0020, 0040, 0050, 0060). `0030__wf__wf-rls-missing`
was found already MOOTED in-file (wf module retired); it remains in `identified/` pending user
sign-off to move it to `addressed/`.

## Gate

No code changes this leg; `pnpm build` unaffected (green as of the 0020 leg; re-verified before
advancing).
