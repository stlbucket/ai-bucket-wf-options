# New Tenant modal — site-admin tenant list

> **Execution Directive:** execute this plan via `/fnb-stack-implementor <this-file>`.
> Spec: `.claude/specs/tenant-app/site-admin/tenant/README.md` (+ `index.ui.md` /
> `index.data.md`). All decisions locked — no `[FILL IN]`s.

**Severity:** MED · **Category:** app · **Created:** 2026-07-27

## Goal

A **New Tenant** button on `/tenant/site-admin/tenant` opening a modal that collects **name +
admin email** and calls the existing `createTenant` GraphQL mutation
(`app_api.create_tenant` — auto-subscribes `auto_subscribe` license packs and invites the email
as tenant admin). On success, navigate to the new tenant's detail page. **No DB changes, no
codegen run, no new `.graphql` docs** — everything below the composable already exists.

## Verified code anchors (checked 2026-07-27)

| Anchor | Fact |
|---|---|
| `packages/graphql-client-api/src/graphql/app/mutation/createAppTenant.graphql` | `mutation CreateTenant($name: String!, $email: String!)` → `createTenant(input: {_name, _email}) { tenant { ...Tenant } }` — exists, currently unconsumed |
| `packages/graphql-client-api/src/generated/fnb-graphql-api.ts:13461` | `useCreateTenantMutation()` already generated — **no codegen needed** |
| `packages/graphql-client-api/src/composables/useSiteAdminTenants.ts` | Target file; already imports `toTenant` mapper + generated hooks; barrel `src/index.ts:18` already `export *`s it — **no barrel change** |
| `packages/graphql-client-api/src/composables/useWorkspaces.ts:76-83` | `createWorkspace` — the exact composable pattern to mirror (`execCreate` → throw on error → `toTenant(result.data?...tenant)`, throw if payload empty) |
| `apps/tenant-app/app/components/WorkspaceCreateModal.vue` | House modal precedent: owns trigger `UButton` + `open` state, `creating?` prop, `create` emit, `defineExpose({ reset })` |
| `apps/tenant-app/app/pages/admin/workspace/index.vue:14-28,47-57` | Parent wiring precedent: `creating` ref, template-ref `reset()`, `30002` detection via `e.message.includes('30002')`, flex-wrap header row with `PageHeader` + modal |
| `apps/tenant-app/app/pages/site-admin/tenant/index.vue` | Page to wire; header currently lacks the flex-wrap action row |
| `apps/tenant-app/app/composables/useSiteAdminTenants.ts` | One-line re-export file to extend |
| `apps/tenant-app/nuxt.config.ts:33` | `'/site-admin/**': { ssr: false }` already set — UC14 covered, no routeRules change |
| `db/fnb-app/deploy/00000000010250_app_policies.sql` (`manage_tenant`) | Insert gated by `p:app-admin-super` via RLS (no `jwt.enforce_permission` in `app_api.create_tenant` — Known Gap recorded in spec, **out of scope here**) |

## Phases

### Phase 1 — graphql-client-api composable
- [x] In `packages/graphql-client-api/src/composables/useSiteAdminTenants.ts`: import
      `useCreateTenantMutation` (generated) and add
      `export function useCreateTenant()` returning
      `{ createTenant(name: string, email: string): Promise<Tenant> }` — mirror
      `useWorkspaces.createWorkspace`: `execCreate({ name, email })`, throw `result.error`,
      map `result.data?.createTenant?.tenant` through `toTenant`, throw if missing.
      (`Tenant` type import from `@function-bucket/fnb-types`.)
- [x] No barrel edit (file already exported); no codegen (hook exists).
- [x] `pnpm -F @function-bucket/fnb-graphql-client-api build` — clean.

### Phase 2 — tenant-app component + re-export
- [x] Append `useCreateTenant` to the re-export line in
      `apps/tenant-app/app/composables/useSiteAdminTenants.ts`.
- [x] Create `apps/tenant-app/app/components/NewTenantModal.vue` modeled line-for-line on
      `WorkspaceCreateModal.vue`:
      - trigger `UButton` "New Tenant", `icon="i-lucide-plus"`, `size="sm"`
      - `UModal` title "New Tenant", description noting the email is invited as tenant admin
      - fields: Name (`UFormField required` + `UInput`, `@keyup.enter="submit"`), Admin email
        (`UFormField required` + `UInput type="email"`)
      - submit disabled unless `form.name.trim()` and email matches a simple
        `/^\S+@\S+\.\S+$/` check (no form-validation library — house Known Gap, keep manual)
      - props `{ creating?: boolean }`, emit `create(name, email)` (trimmed),
        `defineExpose({ reset })`

### Phase 3 — page wiring
- [x] `apps/tenant-app/app/pages/site-admin/tenant/index.vue`: wrap `PageHeader` + modal in the
      workspace-page header row (`flex flex-wrap items-center justify-between gap-3`); add
      `creating` ref + `createModal` template ref + `onCreate(name, email)`:
      `await createTenant(name, email)` → `createModal.value?.reset()` → success toast →
      `navigateTo(\`/site-admin/tenant/\${created.id}\`)`; catch: `30002` →
      "A tenant with this name already exists" toast, else generic error toast; finally clear
      `creating`. (In-app route — `navigateTo` without `external`, unlike the support-mode jump.)

### Phase 4 — verify (read-only; never restart the env — ask the user if needed)
- [x] `pnpm build` (turbo) — the repo gate; zero TS errors.
- [ ] Manual (user-run env): as a super admin on `/tenant/site-admin/tenant`, create a tenant →
      network tab shows `POST /graphql-api/api/graphql` op `CreateTenant` → lands on
      `/site-admin/tenant/{id}` showing auto-subscribed packs + the invited admin resident →
      creating the same name again toasts the duplicate message and keeps the modal open.
- [x] Sync spec: README task-list phases checked; `index.ui.md`/`index.data.md`/README status
      lines flipped to Implemented (noting manual e2e pending).
