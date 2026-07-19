# site-admin/wf-agentic — Agentic Workflow Runs UI

## Status
Implemented 2026-07-19 — built as specced; generated GraphQL names are the digit-aware-camelCase variants (`N8NWorkflowRun`, `n8NWorkflowRunsList` — see `_shared.data.md` Status).

## Route
`/tenant/site-admin/wf-agentic` → `apps/tenant-app/app/pages/site-admin/wf-agentic/index.vue`

Nav: site-admin module tool `tenant-site-admin-wf-agentic`, label **Agentic Workflows**, icon
`i-lucide-bot` (DB-registered, R14 — `_shared.data.md` → Navigation).

## Required Permission
`p:app-admin-super` (nav + page gate are UI hints; the read fn enforces in SQL, R12/R13)

## Layout
`max-w-5xl mx-auto` (UC12, list page). Two `UCard`s (UC4):

1. **Trigger card** — header "Trigger a workflow"
   - `USelect` of triggerable workflow keys: `exerciser`, `sync-breweries`, `sync-airports`
     (static list mirroring the plugin registry's agent-engine entries; `asset-scan` absent —
     upload-endpoint-only)
   - `UTextarea` "Input data (JSON, optional)" — client-side `JSON.parse` validation; parse
     failure → error toast, no mutation
   - `UButton` "Trigger" (icon `i-lucide-play`, `:loading` while the mutation is in flight)
2. **Runs card** — header "Recent runs" + a refresh `UButton` (icon `i-lucide-refresh-cw`,
   ghost) in the header slot
   - `UTable` (**v4 API** — `accessorKey`/`header` columns, `row.original` in cell slots; UC13),
     wrapped in `overflow-x-auto` (UC5)
   - `UEmpty` when there are no runs (UC8): icon `i-lucide-bot`, "No agentic runs yet"

## Table columns (`TableColumn<AgentWorkflowRun>[]`)
| Column | Cell |
|---|---|
| workflowKey | plain text |
| status | `UBadge` (colors below) |
| model | text, `—` when null |
| cost | `usage.total_cost_usd` formatted `$0.0042`; `—` when absent |
| startedAt | locale datetime |
| duration | `finishedAt - startedAt` humanized (`12s`, `3m 05s`); `…` while running |
| tenantId | short id or `—` (anchor-wide runs) |

**Status badge colors:**
| Status | Color |
|---|---|
| RUNNING | info |
| SUCCESS | success |
| ERROR | error |

## Reactive state
```ts
const { runs, fetching, error, refresh } = useAgentWorkflowRuns()   // AgentWorkflowRun[] (fnb-types)
const { triggerWorkflow, fetching: triggering } = useTriggerWorkflow() // existing composable (real API)
const selectedKey = ref('exerciser')
const inputJson = ref('')
```

## User Interactions
| Action | Trigger | Outcome |
|---|---|---|
| Trigger workflow | Trigger button | parse JSON (toast on failure) → `triggerWorkflow(selectedKey, input)` → success toast "Accepted — run <runId>" (`accepted: false` → warning toast "already running") / error toast (UC7) → `refresh()` |
| Refresh runs | Refresh button | `refresh()` (network-only re-query) |

No per-run detail navigation (deferred — README → Open Questions). No polling — manual refresh
only (runs are operator-inspected, not live-monitored).
