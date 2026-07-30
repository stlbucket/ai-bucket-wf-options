# New Tenant modal — admin first/last name + optional phone

> **Execution Directive:** execute this plan via `/fnb-stack-implementor <this-file>`.
> Spec: `docs/specs/tenant-app/site-admin/tenant/README.md` (admin-identity extension,
> Phases 9–12) + `index.ui.md` / `index.data.md`. All decisions locked — no `[FILL IN]`s.

**Severity:** MED · **Category:** app · **Created:** 2026-07-30

## Goal

The New Tenant modal on `/tenant/site-admin/tenant` grows **admin first/last name (required) +
optional phone** (`PhoneSegments`, E.164). `app_api`/`app_fn.create_tenant` gain
`_first_name`/`_last_name`/`_phone` (defaulted) and **pre-create the admin's `app.profile`**
before `invite_user` (the `initialize_anchor` precedent): new profile → insert with the
display-name recipe (**lowercase** first initial + last name → lowercased email local part →
null; UNIQUE-safe; lowercase added at plan close 2026-07-30, user directive);
existing profile → **blank-fill only** (coalesce into nulls, never overwrite). Side effect: the
admin resident is created already linked (`profile_id` set, display_name copied).
`provision_idp_user` links by email at first login and leaves the row untouched
(`db/fnb-app/deploy/00000000010270_profile_idp_user.sql:44-51`). No verification ceremony —
phone is stored raw.

## Verified code anchors (checked 2026-07-30)

| Anchor | Fact |
|---|---|
| `db/fnb-app/deploy/00000000010240_app_fn.sql:665-720` | `app_api.create_tenant(_name, _identifier=null, _email=null, _type='customer')` → `app_fn.create_tenant` (same args); `invite_user` call at :715 |
| `db/fnb-app/deploy/00000000010242_app_fn_definers.sql:269-355` | `app_fn.invite_user` — selects profile by email (:292), resident `display_name = coalesce(_profile.display_name, split_part(_email,'@',1))` (:308), links `profile_id` when profile exists (:347-350) → **pre-creating the profile before this call is sufficient**; `invite_user` itself is untouched |
| `db/fnb-app/deploy/00000000010300_app_fn_initialize_anchor.sql:65-73` | The profile pre-create precedent (insert email/display_name/first/last/phone; idp_user_id stays null) |
| `db/fnb-app/deploy/00000000010220_app.sql:169-184` | `app.profile`: `first_name`/`last_name`/`phone` citext null; `display_name citext null unique`; `full_name` generated |
| `db/fnb-app/sqitch.plan` + `00000000010240_app_fn.sql:1670+` | House pattern for function changes is **in-place edit** of the original deploy file (`update_user`/`update_tenant_status` were added to 10240 with no rework tag) — envs are rebuilt (user-run), not migrated. Add `drop function if exists` guards for the old 4-arg signatures anyway (live-DB redeploy insurance; avoids the PostGraphile overload trap) |
| `packages/graphql-client-api/src/graphql/app/mutation/createAppTenant.graphql` | `mutation CreateTenant($name, $email)` → `createTenant(input: { _name, _email })` — extend with `$firstName!/$lastName!/$phone` → `_firstName/_lastName/_phone` (inflection matches existing `_name`/`_email`; confirm in regenerated schema) |
| `packages/graphql-client-api/src/composables/useSiteAdminTenants.ts:124-136` | `useCreateTenant().createTenant(name, email)` — becomes object-input `createTenant(input: CreateTenantInput)`; barrel already exports the file |
| `packages/graphql-client-api/package.json:15` + `package-layers-pattern.md:367-370` | Codegen: `pnpm -F @function-bucket/fnb-graphql-client-api generate` against the **running** API at `localhost:4000/graphql-api/api/graphql` — requires the DB change deployed first (user-run env rebuild/restart) |
| `apps/tenant-app/app/components/NewTenantModal.vue` | Modal to extend: `form` reactive (name/email), `valid` computed, `create` emit (currently two positional args), `reset()` expose |
| `apps/tenant-app/app/pages/site-admin/tenant/index.vue:11-31` | Page wiring: `onCreate(name, email)` → `createTenant(name, email)`; 30002 catch + toasts + navigate — only the signatures change |
| `packages/auth-layer/app/components/PhoneSegments.vue` | Shared E.164 segmented input (`v-model` `+1XXXXXXXXXX`, `''` while incomplete); already used from tenant-app (`site-admin/sms-test.vue:104`) — auto-importable via the layer chain, no import needed |
| `apps/tenant-app/app/composables/useSiteAdminTenants.ts` | One-line re-export — unchanged (name `useCreateTenant` stays) |

## Phases

### Phase 1 — DB (spec Phase 9)
- [x] Edit `db/fnb-app/deploy/00000000010240_app_fn.sql` **in place** (house pattern):
      - `drop function if exists app_api.create_tenant(citext, citext, citext, app.tenant_type);`
        and same for `app_fn.create_tenant` (before their CREATEs — overload guard).
      - Both signatures gain `_first_name citext default null, _last_name citext default null,
        _phone citext default null`; `app_api` passes through.
      - In `app_fn.create_tenant`, before the `invite_user` call (:715): when `_email is not
        null` — select profile by email; if none, insert
        `app.profile(email, display_name, first_name, last_name, phone)` with display_name =
        `lower(left(_first_name,1) || _last_name)` (e.g. `jsmith`), falling back to
        `split_part(_email,'@',1)` when names are null **or the name is taken**
        (`exists` check on `app.profile.display_name`), and to `null` if that is taken too —
        tenant creation must never fail on a display-name collision. If a profile exists:
        `update` only `first_name = coalesce(first_name, _first_name)` (same for last/phone) +
        `updated_at`.
- [x] Consult `sqitch-expert` before touching the file (mechanics + verify-file expectations);
      **never run `git` during the sqitch session**.
- [x] **STOP — ask the user** to rebuild/redeploy the env — done 2026-07-30 (`pnpm env-rebuild`,
      user-run); verified read-only via GraphQL introspection: `CreateTenantInput` exposes
      `_firstName`/`_lastName`/`_phone`.

### Phase 2 — graphql-client-api (spec Phase 10)
- [x] Extend `createAppTenant.graphql`: `$firstName: String!, $lastName: String!,
      $phone: String` → `input: { _name, _email, _firstName, _lastName, _phone }`.
- [x] `pnpm -F @function-bucket/fnb-graphql-client-api generate` (API must be up post-rebuild);
      confirmed the inflected input field names in the regenerated schema.
- [x] `useSiteAdminTenants.ts`: `useCreateTenant` → `createTenant(input: CreateTenantInput)`
      where `CreateTenantInput = { name: string; email: string; firstName: string;
      lastName: string; phone?: string | null }` (view-type stays in the composable file, R4);
      same throw/`toTenant` mechanics. No barrel edit (file already exported).
- [x] `pnpm -F @function-bucket/fnb-graphql-client-api build` — clean.

### Phase 3 — tenant-app (spec Phase 11)
- [x] `NewTenantModal.vue`: form fields `firstName`, `lastName` (required, trimmed) and
      `phone` (`PhoneSegments`, optional — `''` ⇒ not provided, does not block submit); `valid`
      requires name + first + last + email; emit is `create(payload: NewTenantPayload)`
      (`NewTenantPayload` exported from the SFC; trimmed, `phone || null`); field order per
      `index.ui.md` (name · first · last · email · phone); `@keyup.enter` on text inputs +
      `reset()` clearing all five.
- [x] `site-admin/tenant/index.vue`: `onCreate(payload)` → `createTenant(payload)` (+ the
      `NewTenantPayload` type import); toasts, 30002 handling, navigation unchanged.
- [x] Re-export file untouched.

### Phase 4 — verify + spec sync (spec Phase 12; read-only — never restart the env)
- [x] `pnpm build` (turbo) — the repo gate ✅ 13/13, zero TS errors (2026-07-30).
- [ ] Manual (user-run env): create a tenant with names + phone → detail page shows the admin
      resident **already linked** with display_name `jsmith`-style; profile row has
      first/last/phone (E.164). Create with an **existing** user's email → their profile only
      blank-filled, display_name untouched. Phone omitted → `profile.phone` null. Duplicate
      tenant name → 30002 toast, modal stays open.
- [x] Sync spec: README Phases 9–12 checked; status lines in README /
      `index.ui.md` / `index.data.md` flipped (Draft → Implemented, manual-e2e note);
      `_shared.data.md` row already updated 2026-07-30.
