# Invite popup collects profile details (first/last/display/email/phone)

> **Execution Directive:** execute this plan via `/fnb-stack-implementor <this-file>` — it
> implements Phase 6 (U10) of `docs/specs/user-invitation/README.md`. Build order is DB →
> workflow → client → UI; each step names its verified code anchor.

## Source spec
`docs/specs/user-invitation/` — locked decision **U10** (2026-08-07). Contracts:
- `_shared.data.md` → "Resident creation — `app_fn.invite_user` … U10" + "Input contract … U10"
  + ZITADEL name-derivation.
- `invite-user.workflow.md` → nodes 3 (Create Resident) + 4 (ZITADEL).
- `admin-invite.ui.md` / `admin-invite.data.md` → modal fields + `InviteUserInput` + `31020` mapping.

## Locked decisions (from the user, do not re-litigate)
1. **Email required**; first_name, last_name, display_name, phone optional.
2. **Re-invite fills only blanks** — never overwrite an existing profile value.
3. **Explicit display_name collision → reject** with new errcode `31020` (auto-derived path keeps
   its collision→null fallback).

## Category / severity
`app` · MED. No new DB table, no new GraphQL surface, no plugin/registry change — the four new
fields ride the existing `triggerWorkflow` `inputData` bag and four appended defaulted DB params.

---

## Step 1 — DB: `app_fn.invite_user` profile params  → skill `fnb-db-designer` (schema/errcode dialect), `sqitch-expert` (revert/verify sync)
**File (in-place edit, rebuild-only env):** `db/fnb-app/deploy/00000000010242_app_fn_definers.sql`
(function at line ~269). Append four defaulted params:

```sql
app_fn.invite_user(
    _tenant_id uuid
   ,_email citext
   ,_assignment_scope app.license_type_assignment_scope default 'user'
   ,_first_name   citext default null
   ,_last_name    citext default null
   ,_display_name citext default null
   ,_phone        citext default null
  ) returns app.resident
```

- Normalize each incoming text: `_first_name := nullif(trim(_first_name),'')` (same for last/phone/
  display) at the top of the body, so blank form fields become `null`.
- **New-profile branch** (existing `if _profile.id is null`): when `_display_name` is not null, check
  `exists (select 1 from app.profile where display_name = _display_name)` → if found
  `raise exception '31020: DISPLAY NAME ALREADY TAKEN';`. Otherwise use it. When null, keep the
  current collision-safe email-local-part-else-null derivation. Extend the `insert into app.profile`
  to `(email, display_name, first_name, last_name, phone)`.
- **Existing-profile branch (re-invite):** fill only blanks —
  `update app.profile set first_name = coalesce(first_name, _first_name),
   last_name = coalesce(last_name, _last_name), phone = coalesce(phone, _phone) where id = _profile.id`
  (only when at least one supplied — or unconditionally, coalesce is a no-op otherwise). For
  `display_name`: only when the existing value **is null** and `_display_name` is not null, run the
  same `31020` uniqueness check and set it; if the profile already has a display name, ignore the
  supplied one (no error).
- Leave the resident/license/`res.resource` logic and the final `profile_id` link unchanged.
- **Existing callers** (`create_app_tenant`/`create_workspace`/`initialize_anchor` →
  `'admin'`/`'superadmin'`; `set_workspace_membership` `00000000010242…:~619` → `'user'`; block
  cascade) pass 3 positional args and stay valid via the defaults — verify each still resolves.
- **Update the change's revert + verify** for this deploy file — verify asserts the **7-arg**
  signature exists (`pg_get_function_arguments` / `has_function`).

**Verify (read-only, rolled-back claims-simulated txn — ask the user to rebuild first):**
new profile with all five fields set (full_name generated); re-invite of an existing profile fills
only null columns; an explicit duplicate `_display_name` raises `31020`; blank args land as `null`;
a 3-arg legacy call still works.

## Step 2 — n8n workflow  → skill `n8n-cli`
**File:** `n8n/workflows/invite-user.json`.
- **Create Resident** node (~line 40): change query to the 7-arg call
  `select id from app_fn.invite_user($1::uuid, $2::citext, 'user', $3::citext, $4::citext, $5::citext, $6::citext)`
  and `queryReplacement` to
  `[ body.tenantId, body.email, body.firstName, body.lastName, body.displayName, body.phone ]`
  (from `$('Webhook').item.json.body`). Empty strings are fine — the DB normalizes `'' → null`.
- **Invite Via ZITADEL** Code node (~line 63): read `firstName`/`lastName`/`displayName`/`phone`
  from the body; derive `givenName = firstName || (displayName split[0]) || email`,
  `familyName = lastName || (displayName split rest) || email`; greeting
  `vars.displayName = displayName || firstName || email`. Keep the `$env`-not-`process.env` rule
  (memory `n8n-code-node-env-dollar-env`).
- Re-import per the `n8n-cli` operator loop; keep the shared `error-handler` active (R22). The
  `31020` from the DB node lands on the error branch (email mode) or surfaces synchronously (link
  mode, `responseMode: lastNode`).

## Step 3 — Client composable  → verify the 3 barrels (`references/special-cases.md`)
**File:** `packages/graphql-client-api/src/composables/useInviteUser.ts` (+ re-export
`apps/tenant-app/app/composables/useInviteUser.ts`, unchanged single line).
- Widen `InviteUserInput`: make `displayName?` optional; add `firstName?`, `lastName?`, `phone?`
  (keep `email` required, `mode?`).
- In `invite()`, forward the new keys into the `triggerWorkflow('invite-user', …)` `inputData`
  (drop blank/undefined). No new `.graphql`, no codegen, no registry/plugin change.
- Confirm the `graphql-client-api` `src/index.ts` barrel already exports `useInviteUser`
  (it does — no new export needed).

## Step 4 — tenant-app UI  → Nuxt UI v4 only (UC3/UC4/UC5)
**File:** `apps/tenant-app/app/components/InviteUserModal.vue`.
- Extend `form` reactive to `{ firstName, lastName, displayName, email, phone }`.
- Fields: First name + Last name in a `grid grid-cols-1 sm:grid-cols-2 gap-4` row; Display name
  (`i-lucide-id-card`, no longer `required`); Email (`type="email"`, required, keep `emailValid`);
  Phone (`type="tel"`, `i-lucide-phone`). Keep the "Send invite immediately" checkbox + link view.
- `canSubmit` = `emailValid.value` only (drop the displayName requirement).
- `submit()` passes `{ email, firstName, lastName, displayName, phone, mode }` (trim, omit blanks).
- `reset()` clears all five fields.
- `mapError`: add a `/31020|display name already taken/i` case → *"That display name is already
  taken — pick another."*

## Step 5 — Gate
- `pnpm build` green (repo-wide `pnpm lint` is known-broken — build is the gate).
- Update `docs/specs/user-invitation/README.md` Phase 6 checkboxes + status as steps land.

## Async caveat (documented, not a bug)
In **email mode** the workflow responds `{ accepted: true }` before the Create-Resident node runs,
so a `31020` collision is only in the n8n run log — the admin sees no synchronous error. Surfaces
synchronously only in **link mode**. v1 accepts this (matches the existing "resident appears a beat
later" model); future options (pre-check query / resident-before-respond) noted in
`admin-invite.ui.md`.

## Execution outcome (2026-08-07) — Implemented + verified
- **Steps 1–5 done.** DB (`app_fn.invite_user` 7-arg), workflow, composable, modal all landed;
  `pnpm build` 13/13.
- **Extra DB fix (not in the original plan):** the first rebuild deploy failed —
  `fnb-n8n:00000000011240_n8n_worker_app_invite` granted execute on the **old 3-arg** signature.
  Fixed its deploy/revert/verify to the 7-arg signature (deploy-order dependency `fnb-app`→`fnb-n8n`).
- **Verified after user rebuild:** DB rolled-back txn (new profile seeds 5 fields incl. generated
  `full_name`; re-invite fills blanks only; explicit dup display_name → `31020`; legacy 3-arg
  resolves; grant live); live webhook link-mode invite seeds the profile through `queryReplacement`
  + creates the ZITADEL user; pgTAP `032` passes.
- **Documented caveat:** n8n masks the `31020` node error behind a generic webhook 500 → the admin
  sees a generic failure toast, not the specific "display name taken" reason (link mode). No bad
  data written. mapError copy + spec caveat updated; specific-message surfacing left as a follow-up.

## Notes
- Never run `git`; never rebuild/restart the env — ask the user, verify read-only.
- Memory: `profile-display-name-unique` (collision-safe cascade), `n8n-code-node-env-dollar-env`.
