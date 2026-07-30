# Execution log — 0030_recur__rls-permission-audit — 2026-07-23

Audit-only leg (DB fixes need sqitch changes + a redeploy the agent never runs). The db surface
since 2026-07-22 is the new **`db/fnb-poll`** module (13th package) plus data-only edits to
`fnb-app` (`app_fn.sql` nav registration, R14) and `fnb-res` (`res.sql` — the
`('poll', 'p:poll')` module-registry row). Full six-item sweep on `fnb-poll`; standing findings
re-confirmed elsewhere.

## fnb-poll sweep (poll.poll, poll.question, poll.option, poll.response, poll.answer)

1. **RLS enabled on every table** — ✓ all five, correct table names
   (`00000000011130_poll_policies.sql`).
2. **≥1 policy using `jwt.*` helpers** — ✓ all five. Read policies implement the draft-visibility
   rule (creator-or-`p:poll-admin` for drafts); `response`/`answer` use own-rows FOR ALL policies
   keyed on `respondent_resident_urn` = caller's resident urn, plus an others-read policy gated
   on `p:poll-admin` or `results_visibility = 'attributed'`. Write policies are tenant-fenced
   with WITH CHECK. Coherent design, no copy-paste table-name bugs.
3. **Blanket anon grants** — ✗ **GAP** (standing class, folded — see below).
   `poll_policies.sql:11-17` blanket-grants all `poll_fn` routines (+ default privileges) to
   `anon, authenticated, service_role` — the exact `0020__security__fn-schema-grant-bypass`
   pattern.
4. **`_api` mutations gated before `_fn`** — ✓ exemplary discipline: every one of the ~14
   `poll_api` functions calls `jwt.enforce_permission('p:poll')` first and passes jwt-derived
   identity (`jwt.resident_id()`, `jwt.has_permission('p:poll-admin')`) down as explicit
   parameters; `poll_fn` never calls `jwt.*` (stated contract at `poll_fn.sql:3`, holds
   throughout).
5. **SECURITY DEFINER pins search_path** — the module's single DEFINER function
   (`poll_fn.get_poll_results`) pins `search_path = pg_catalog, public` — pinned and its body
   schema-qualifies all table refs, so no pgcrypto-style resolution risk, but it deviates from
   the house `set search_path = ''`. Noted inside the 0020 scope update ("align when touched")
   rather than added to the 0050 search-path item, whose subject is *unpinned* functions.
6. **No superuser connections** — ✗ standing gap unchanged: `.env`
   `DATABASE_URL=postgresql://postgres:…` (`0040__security__superuser-database-url`, HI). Not
   re-spawned.

## Finding folded into the standing CRT item (no duplicate spawned)

- **`identified/0020__security__fn-schema-grant-bypass`** — appended a dated
  "Scope update — 2026-07-23" adding `poll_fn` as items 5–6:
  - `poll_fn.get_poll_results(_poll_id, _tenant_id, _resident_id, _is_admin)` is SECURITY
    DEFINER with all four identity/authority inputs caller-controlled and granted to anon —
    a direct caller can pass `_is_admin := true` + any tenant id and read cross-tenant poll
    results, including attributed per-respondent rows.
  - The INVOKER `poll_fn` writers let any tenant member skip the `p:poll` license gate and the
    admin-branch check (`_is_admin` parameter) that `poll_api` enforces.

## Standing findings re-confirmed (no duplicates spawned)

- `0020__security__fn-schema-grant-bypass` (CRT) — now also covers `poll_fn` (see above).
- `0040__security__superuser-database-url` (HI) — `.env` postgres role, unchanged.
- `0050__security__security-definer-search-path` (HI) — unchanged (poll's one DEFINER is
  pinned; deviation noted in 0020's scope update).
- `0060__security__rls-gaps-msg-loc-app` (HI) — unchanged.
- `fnb-res` spot-check: `res.resource` + `res.module_permission` both RLS-enabled; the poll
  registry row is data-only.

## Fixed inline

- `identified/0020__…grant-bypass` — the 2026-07-23 scope-update section (doc edit only).

## Spawned identified/ items

None — the one new gap belongs to the existing tracked CRT class.

## Gate

No product-code changes this leg (one `identified/*.md` edit only); `pnpm build` unaffected —
green as of the 0020 leg.
