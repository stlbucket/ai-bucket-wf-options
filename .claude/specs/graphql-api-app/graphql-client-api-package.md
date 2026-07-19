---
name: graphql-client-api-package
description: How packages/graphql-client-api works — codegen workflow, GraphQL files layout, generated hooks, composables, and the re-export pattern used by consuming apps.
metadata:
  type: reference
---

## Status
Implemented — reverse-engineered from the existing codebase.

---

## Package Identity

```
name:    @function-bucket/fnb-graphql-client-api
path:    packages/graphql-client-api/
type:    compiled library (dist/index.js + dist/index.d.ts)
main:    ./dist/index.js
types:   ./dist/index.d.ts
```

Peer deps: `@urql/vue >= 2.0.0`, `vue >= 3.0.0`

---

## Purpose

This package is the **shared GraphQL client layer** for the entire monorepo. It:
1. Holds all `.graphql` query/mutation/fragment files
2. Runs graphql-codegen to generate typed urql hooks and TypeScript types
3. Wraps the generated hooks in thin composables that expose a clean API
4. Exports everything via `src/index.ts` → `dist/index.js`

Apps (graphql-api-app, tenant-app) import from this package, then create local re-export files so Nuxt's auto-import sees the composables.

---

## Build / Codegen Workflow

```bash
pnpm generate   # graphql-codegen: updates src/generated/ and src/generated/fnb-graphql-api.ts
pnpm build      # vite build: compiles src/ → dist/
pnpm dev        # vite build --watch
```

**codegen.ts** config:
- **Schema source:** `http://localhost:4000/graphql-api/api/graphql` (live introspection — app must be running)
- **Documents:** `src/graphql/**/*.graphql`

**Outputs:**
| File | Generator | Content |
|---|---|---|
| `src/generated/fnb-graphql-api.ts` | `typescript` | All PostgreSQL-derived TypeScript types (enumsAsTypes: true) |
| `graphql/schema.json` | `introspection` | Full GraphQL schema JSON |
| `graphql/schema.min.json` | `urql-introspection` | Minified schema for urql caching |
| `src/generated/fnb-graphql-api.ts` | `typescript` + `typescript-operations` + `typescript-vue-urql` | All typed operation hooks (`useXxxQuery`, `useXxxMutation`) |

**api.ts config:**
```ts
gqlImport: '@urql/vue#gql'
arrayInputCoercion: false
nonOptionalTypename: true
```

---

## GraphQL File Structure

```
src/graphql/
├── address-book/
│   ├── fragment/  (none)
│   ├── mutation/  joinAddressBook.graphql, leaveAddressBook.graphql
│   └── query/     getAbListings.graphql
├── app/
│   ├── fragment/  Application, License, LicensePack, LicensePackLicenseType,
│   │              LicenseType, LicenseTypePermission, Profile, ProfileClaim,
│   │              Resident, Tenant, TenantSubscription
│   ├── mutation/  activateAppTenant, assumeResidency, becomeSupport, blockResidency,
│   │              createAppTenant, deactivateAppTenant, deactivateTenantSubscription,
│   │              declineResidency, exitSupportMode, grantUserLicense,
│   │              reactivateTenantSubscription, revokeUserLicense,
│   │              subscribeTenantToLicensePack, unblockResidency, updateProfile,
│   │              updateResidentStatus, updateTenant, updateUser, updateUserStatus
│   └── query/     activeLicensePacks, adminSubscriptions, allApplications,
│                  allAppProfiles, allLicensePacks, allResidents, applicationByKey,
│                  appTenantById, appTenantLicenses, appTenantResidents,
│                  appTenantSubscriptions, availableModules, currentProfileClaims,
│                  getMyself, myProfileResidencies, raiseException, residentById,
│                  searchProfiles, searchResidents, searchTenants, siteUserById
├── discussions/
│   ├── fragment/  Message, Subscriber, Topic
│   ├── mutation/  upsertMessage, upsertSubscriber, upsertTopic
│   └── query/     allDiscussions, discussionById, msgResidents
├── locations/
│   ├── fragment/  Location
│   ├── mutation/  createLocation, deleteLocation, updateLocation
│   └── query/     allLocations
├── msg/
│   └── query/     mySubscribedTopics
├── support/
│   ├── fragment/  SupportTicket, SupportTicketComment
│   ├── mutation/  closeSupportTicket, deleteSupportTicket, markDuplicateSupportTicket,
│   │              parkSupportTicket, reopenSupportTicket, submitSupportTicket,
│   │              submitSupportTicketComment
│   └── query/     allSupportTickets, supportTicketById
├── todo/
│   ├── fragment/  Todo
│   ├── mutation/  createTodo, deleteTodo, makeTemplateFromTodo, makeTodoFromTemplate,
│   │              pinTodo, unpinTodo, updateTodo, updateTodoStatus
│   └── query/     assignTodo, searchTodos, todoById, todoByIdForRefresh,
│                  todoResidentsList
└── wf/
    ├── fragment/  wf.graphql, uow.graphql, uowDependency.graphql
    ├── mutation/  pullTrigger, queueWorkflow, resetWfLayout, saveWfLayout
    └── query/     allWfInstances, allWfTemplates, wfById, wfTemplateByIdentifier
```

---

## Workflow GraphQL Documents

### Fragments

**`Wf` fragment** (on `Wf` type):
```graphql
fragment Wf on Wf {
  id, createdAt, updatedAt, tenantId, identifier, isTemplate, type, name,
  description, inputDefinitions { name, dataType, defaultValue, isRequired },
  instanceCount, status, workflowData, layoutOverride
}
```

**`Uow` fragment** (on `Uow` type):
```graphql
fragment Uow on Uow {
  id, completedAt, createdAt, data, description, dueAt, identifier,
  isTemplate, name, parentUowId, status, tenantId, type, updatedAt,
  useWorker, wfId, workflowError, workflowHandlerKey
}
```

**`UowDependency` fragment** (on `UowDependency` type):
```graphql
fragment UowDependency on UowDependency {
  id, tenantId, wfId, dependerId, dependeeId
}
```

### Queries

**`AllWfInstances`:** `wfsList(condition: { isTemplate: false }) { ...Wf }`
Aliased to `wfInstances`.

**`AllWfTemplates`:** `wfsList(condition: { isTemplate: true }) { ...Wf }`
Aliased to `wfTemplates`.

**`WfById($id: UUID!)`:** `wf(id: $id) { ...Wf, uowsList { ...Uow }, uowDependenciesList { ...UowDependency }, template { ...Wf } }`

**`WfTemplateByIdentifier($identifier: String!)`:** `wfTemplateByIdentifier(_identifier: $identifier) { ...Wf, uowsList { ...Uow }, uowDependenciesList { ...UowDependency } }`

### Mutations

**`QueueWorkflow($identifier: String!, $workflowInputData: JSON!)`:**
```graphql
queueWorkflow(input: { _identifier: $identifier, _workflowInputData: $workflowInputData }) { json }
```
Returns `json` — a raw JSONB blob that includes `{ wf: { id } }`.

**`PullTrigger($uowId: UUID!, $triggerData: JSON)`:**
```graphql
pullTrigger(input: { _uowId: $uowId, _triggerData: $triggerData }) { uow { ...Uow } }
```

**`SaveWfLayout($wfIdentifier: String!, $layout: JSON!)`:**
```graphql
saveWfLayout(input: { _wfIdentifier: $wfIdentifier, _layout: $layout }) { wf { ...Wf } }
```

**`ResetWfLayout($wfIdentifier: String!)`:**
```graphql
resetWfLayout(input: { _wfIdentifier: $wfIdentifier }) { wf { ...Wf } }
```

---

## Composables (src/composables/)

All composables wrap generated urql hooks. Pattern: thin wrapper that extracts the relevant data field, keeps `fetching`/`error`, and exposes a `refresh` function via `executeQuery({ requestPolicy: 'network-only' })`.

| File | Exported function | Source hook | Returns |
|---|---|---|---|
| `useWfInstances.ts` | `useWfInstances()` | `useAllWfInstancesQuery` | `{ wfInstances, fetching, error, refresh }` |
| `useWfTemplates.ts` | `useWfTemplates()` | `useAllWfTemplatesQuery` | `{ wfTemplates, fetching, error, refresh }` |
| `useWfDetail.ts` | `useWfDetail(id: MaybeRef<string>)` | `useWfByIdQuery` | `{ wf, fetching, error, refresh }` |
| `useQueueWorkflow.ts` | `useQueueWorkflow()` | `useQueueWorkflowMutation` | `{ queueWorkflow(identifier, workflowInputData), fetching }` |
| `usePullTrigger.ts` | `usePullTrigger()` | `usePullTriggerMutation` | `{ pullTrigger(uowId), fetching }` |

### `useWfDetail` specifics
- `id` is a `MaybeRef<string>` — query variables are reactive via `computed(() => ({ id: unref(id) }))`
- `wf` is `computed(() => data.value?.wf ?? null)`

### `useQueueWorkflow` specifics
- `queueWorkflow(identifier, workflowInputData)` returns `Promise<string>` (the new WF id)
- Extracts `result.data?.queueWorkflow?.json?.wf?.id`
- Throws if the ID is missing

### `usePullTrigger` specifics
- `pullTrigger(uowId)` returns the updated `Uow` or null
- Extracts `result.data?.pullTrigger?.uow ?? null`

---

## `src/index.ts` Exports

```ts
export * from './generated/fnb-graphql-api'        // all PostgreSQL-derived types
export { useUpsertMessageMutation, WorkflowInputDataType } from './graphql/api'
export type { UowFragment, UowDependencyFragment, WfFragment, WfByIdQuery } from './graphql/api'
export * from './composables/useWfInstances'
export * from './composables/useWfDetail'
export * from './composables/useWfTemplates'
export * from './composables/useQueueWorkflow'
export * from './composables/usePullTrigger'
// ... plus all other module composables
```

`WorkflowInputDataType` is the generated enum for `workflow_input_data_type` — used by `WfQueueModal.vue` to render the correct input component per field.

---

## Re-Export Pattern in Consuming Apps

Apps that consume this package do not import directly; they create local re-export files in `app/composables/` so Nuxt auto-import picks them up:

```ts
// apps/graphql-api-app/app/composables/useWfInstances.ts
export { useWfInstances, type WfFragment } from '@function-bucket/fnb-graphql-client-api'

// apps/graphql-api-app/app/composables/useWfDetail.ts
export { useWfDetail } from '@function-bucket/fnb-graphql-client-api'

// apps/graphql-api-app/app/composables/usePullTrigger.ts
export { usePullTrigger } from '@function-bucket/fnb-graphql-client-api'

// apps/graphql-api-app/app/composables/useQueueWorkflow.ts
export { useQueueWorkflow } from '@function-bucket/fnb-graphql-client-api'

// apps/graphql-api-app/app/composables/useWfTemplates.ts
export { useWfTemplates } from '@function-bucket/fnb-graphql-client-api'
```

`useWfFlowGraph` is the only composable defined locally — it doesn't need to live in the shared package because it's UI/layout logic (ELK + VueFlow), not a data-fetching concern.
