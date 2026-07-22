# Send-Test Page — Data (site-admin)

## Status
Draft — fill in all `[FILL IN]` sections before implementing. Phase 4 (D7).

## Send path — `triggerWorkflow` carve-out

The page dispatches through the **existing** `triggerWorkflow` GraphQL mutation (the same registry
entry the invite path uses), not a bespoke route:

```
triggerWorkflow(workflowKey: "send-notification", inputData: {
  channel, templateKey, to, subject, vars, tenantId, profileId
}) → { runId? }        // fire-and-forget; the row + Mailpit are the evidence
```

- Composable: `useSendTest()` in `packages/graphql-client-api/src/composables/useSendTest.ts`,
  re-exported thinly at `apps/tenant-app/app/composables/useSendTest.ts` (R1). Wraps the generated
  `triggerWorkflow` mutation hook.
- Permission: the mutation is already claims-gated (401 without claims); the **page** gate is
  `p:app-admin-super`. The workflow runs as `n8n_worker` and writes the row.
- No new DB mutation surface — sends only originate inside the workflow (consistent with storage:
  no GraphQL insert that could forge a notification).

```ts
// packages/graphql-client-api/src/composables/useSendTest.ts (shape)
export function useSendTest() {
  const { executeMutation } = useTriggerWorkflowMutation()
  async function send(input: SendTestInput) {
    const res = await executeMutation({
      workflowKey: 'send-notification',
      inputData: input,
    })
    if (res.error) throw res.error
  }
  return { send }
}
```

## Recent sends — read

- Operation: `RecentNotifications` — `.graphql` query at
  `packages/graphql-client-api/src/graphql/notify/query/recentNotifications.graphql` — selects the
  exposed `notify.notification` fields (id, channel, status, templateKey, recipient, subject,
  tenantId, provider, createdAt, sentAt), `orderBy: CREATED_AT_DESC`, `first: N`.
- RLS scopes it to the super-admin's tenant + tenant-less rows (`_shared.data.md` policy) — no
  explicit tenant filter needed.
- Composable: `useRecentNotifications()` (same package + thin re-export); returns
  `{ items, fetching, error, executeQuery }`. Re-run with
  `executeQuery({ requestPolicy: 'network-only' })` after a send (no `refresh`).
- Mapper: `toNotification` (`src/mappers/notification.ts`) → `Notification` (`fnb-types`, R3).

## Requirements
- `'notify'` added to `graphile.config.ts` `schemas` (see `_shared.data.md`) so the type +
  `recentNotifications` list exist.
- `triggerWorkflow` already registered for `send-notification` (Phase 2).

## Open Questions
- [ ] Free-body vs. structured `vars` input for non-`test` templates.
- [ ] Show `payload`/`error` on row expand (may need those columns exposed — weigh against the
      PII/hide decision in `_shared.data.md`).
