# admin/nestable-tenant-types — UI

## Status
Draft — build-ready. Three surgical UI touch points; no new pages. Data contracts in
`_shared.data.md`. UI rules: UC3 (Nuxt UI first), UC6 (color tokens), UC11 (`i-lucide-*`).

---

## 1. Manage-Residents gate — `apps/tenant-app/app/pages/admin/user/index.vue`

Broaden the workspace-only gate to the full nestable set. The pool + membership functions now
serve `client`/`organization` identically.

```ts
const NESTABLE_TYPES = ['WORKSPACE', 'CLIENT', 'ORGANIZATION']
// was: const isWorkspace = computed(() => user.value?.tenantType === 'WORKSPACE')
const isNested = computed(() => NESTABLE_TYPES.includes(user.value?.tenantType ?? ''))
```
Template: `<WorkspaceResidentsModal v-if="isNested" @changed="onRosterChanged" />`. Component
name + button label ("Manage Residents") unchanged.

---

## 2. Context-aware type dropdown — `apps/tenant-app/app/pages/site-admin/tenant/[id].vue`

`p:app-admin-super`. The existing `USelect` (bound to `form.type`, saved via `update_tenant`) gets
**context-aware options** so a root tenant never offers a nested type and vice-versa — the DB
`chk_nested_parent` constraint is the backstop, this is the UX guard.

```ts
// requires the tenant detail query to select `parentTenantId`
const isNestedTenant = computed(() => tenant.value?.parentTenantId != null)

const ROOT_TYPES = ['anchor', 'customer', 'demo', 'test', 'trial']
const NESTED_TYPES = ['workspace', 'client', 'organization']

const typeOptions = computed(() =>
  (isNestedTenant.value ? NESTED_TYPES : ROOT_TYPES).map(v => ({ label: v, value: v })),
)
```
The `<UFormField label="Type"><USelect :items="typeOptions" v-model="form.type" /></UFormField>`
markup is unchanged.

---

## 3. Nested-type editor — `apps/tenant-app/app/pages/admin/workspace/[id].vue`

`p:app-admin`. Every tenant listed here is a **direct child** (a nested node), so the editor
always offers the nestable trio. Add to the summary `UCard` header/body, near the status badge:

```vue
<UFormField label="Type">
  <div class="flex items-center gap-2">
    <USelect
      v-model="typeForm"
      :items="NESTED_TYPE_OPTIONS"
      :disabled="savingType"
      size="sm"
    />
    <UButton
      size="sm"
      :loading="savingType"
      :disabled="typeForm === workspace?.type?.toLowerCase()"
      @click="onSaveType"
    >
      Save
    </UButton>
  </div>
</UFormField>
```

```ts
const { setNestedType } = useWorkspaceDetail(String(route.params.id))  // add to the existing destructure
const NESTED_TYPE_OPTIONS = ['workspace', 'client', 'organization'].map(v => ({ label: v, value: v }))
const typeForm = ref('')
const savingType = ref(false)
watchEffect(() => { if (workspace.value) typeForm.value = String(workspace.value.type).toLowerCase() })

async function onSaveType() {
  if (!workspace.value) return
  savingType.value = true
  try {
    await setNestedType(workspace.value.id, typeForm.value.toUpperCase() as TenantType)
    toast.add({ title: 'Type updated', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to update type', color: 'error' })
  } finally {
    savingType.value = false
  }
}
```
- Gate the whole `UFormField` behind `p:app-admin` (`canManage`-style computed off `useAuth`).
- The detail query must select `type` on the workspace row (add if absent) so the editor
  initializes and the Save button disables when unchanged.
- On success the composable re-runs the detail query (network-only); the badge/label refresh.

## Interactions summary

| Page | Who | Control | Effect |
|---|---|---|---|
| `admin/user` | `p:app-admin` in a nested tenant | Manage Residents button | Opens the spine-scoped roster modal (any nestable type) |
| `site-admin/tenant/[id]` | `p:app-admin-super` | Type USelect (context-aware) | `update_tenant` — root **or** nested types per the tenant |
| `admin/workspace/[id]` | `p:app-admin` | Type USelect + Save | `set_nested_tenant_type` — direct-child nestable relabel |
