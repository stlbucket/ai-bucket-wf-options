# site-admin/wf-n8n — n8n Workflow Runs UI

## Status
Implemented 2026-07-19 — built as specced; generated GraphQL names are the digit-aware-camelCase variants (`N8NWorkflowRun`, `n8NWorkflowRunsList` — see `_shared.data.md` Status).

## Route
`/tenant/site-admin/wf-n8n` → `apps/tenant-app/app/pages/site-admin/wf-n8n/index.vue`

Nav: site-admin module tool `tenant-site-admin-wf-n8n`, label **n8n Workflows**, icon
`i-lucide-workflow` (DB-registered, R14 — `_shared.data.md` → Navigation).

## Required Permission
`p:app-admin-super` (UI hint; the read fn enforces in SQL, R12/R13)

## Layout
`max-w-5xl mx-auto` (UC12). Mirrors `wf-agentic.ui.md` deliberately — same two-`UCard` layout
(UC4), plus the editor link:

1. **Trigger card** — header "Trigger a workflow", with a trailing header-slot `UButton`
   **"Open n8n editor"** (icon `i-lucide-external-link`, variant outline,
   `:to="editorUrl" target="_blank"`, rendered only when `editorUrl` is non-empty —
   `runtimeConfig.public.n8nEditorUrl`)
   - `USelect` of triggerable keys: `n8n-exerciser` (static list mirroring the registry's
     n8n-engine entries — grows as workflows move engines)
   - `UTextarea` "Input data (JSON, optional)" — client-side parse, error toast on failure
   - `UButton` "Trigger" (icon `i-lucide-play`, `:loading`)
2. **Runs card** — header "Recent runs" + ghost refresh `UButton` (`i-lucide-refresh-cw`)
   - `UTable` (**v4 API**, UC13) in `overflow-x-auto` (UC5)
   - `UEmpty` when no runs (UC8): icon `i-lucide-workflow`, "No n8n runs yet"

## Table columns (`TableColumn<N8nWorkflowRun>[]`)
| Column | Cell |
|---|---|
| workflowKey | plain text |
| status | `UBadge` (colors below) |
| n8nExecutionId | monospace text, `—` when null (correlates to the editor's execution log) |
| startedAt | locale datetime |
| duration | humanized; `…` while running |
| tenantId | short id or `—` |

**Status badge colors:**
| Status | Color |
|---|---|
| RUNNING | info |
| SUCCESS | success |
| ERROR | error |

## Reactive state
```ts
const { runs, fetching, error, refresh } = useN8nWorkflowRuns()     // N8nWorkflowRun[] (fnb-types)
const { triggerWorkflow, fetching: triggering } = useTriggerWorkflow() // existing composable (real API)
const editorUrl = useRuntimeConfig().public.n8nEditorUrl             // '' sentinel → button hidden
const selectedKey = ref('n8n-exerciser')
const inputJson = ref('')
```

## User Interactions
| Action | Trigger | Outcome |
|---|---|---|
| Trigger workflow | Trigger button | parse JSON → `triggerWorkflow(selectedKey, input)` → toast "Accepted" (no runId — n8n webhooks respond immediately) / error toast (UC7) → `refresh()` |
| Refresh runs | Refresh button | `refresh()` |
| Open editor | Editor button | new tab → `http://localhost:${N8N_HOST_PORT}` (step-level debugging lives there) |

No per-run detail page; no polling — same deferrals as the agentic page. A `RUNNING` row with
`waitForResume` resumes from the editor (Wait node resume URL — `exerciser.workflow.data.md`).
