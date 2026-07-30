# tools/poll/index — Poll List UI

## Status
Implemented — GraphQL (2026-07-23). See README for verification + the deferred OTP phase.

## Route
`/tenant/tools/poll` → `apps/tenant-app/app/pages/tenant/tools/poll/index.vue`

## Required Permission
`p:poll` (via nav tool entry — `{"p:app-user","p:app-admin","p:poll"}`). DB enforces `p:poll` on
mutations.

## Layout
Single `UCard` (UC4) with a header toolbar and a responsive list body (todo index precedent).

### Header
1. Title row: `"Polls"` (text-2xl) left, **New Poll** button right.
2. Search row: label `"SEARCH"` (text-xs) above a `UInput` bound to `searchTerm`.
3. Filter row: a `USelectMenu`/`UButtonGroup` status filter (`All` · `Open` · `Closed` · `Drafts`)
   + a `USwitch` "Only mine".

### Body
| Breakpoint | Component |
|---|---|
| `md` and above | `PollList` (table) |
| below `md` | `PollListSmall` (cards) |

Both receive `polls: PollSummary[]`.

## Component: `PollList`
*`apps/tenant-app/app/components/poll/PollList.vue`* — Props: `polls: PollSummary[]`

- Table (responsive, `overflow-x-auto`, UC5). Columns: title · status badge · your-answer badge ·
  responses count · closes (relative) · created-by displayName.
- Row click → `navigateTo('/tenant/tools/poll/{id}')`.

## Component: `PollListSmall`
*`apps/tenant-app/app/components/poll/PollListSmall.vue`* — Props: `polls: PollSummary[]`
- Compact card per poll: title, status badge, your-answer badge. Tap → detail.

## Component: `PollModal`
*`apps/tenant-app/app/components/poll/PollModal.vue`*
- `UModal` with a form: `title` (required, min 3), `description` (optional).
- Submit → emits `@created` with `{ title, description }`; the page calls `createPoll` then
  navigates to the new `[id]` (draft editor).

## Status Badge Colors (UC6 tokens)
| `status` | color |
|---|---|
| `DRAFT` | neutral (gray) |
| `OPEN` | success (green) |
| `CLOSED` | neutral (gray) / `info` if recently closed |

## Your-Answer Badge
| Caller state | badge |
|---|---|
| no response | `warning` "Not answered" |
| response, `submittedAt` null | `info` "In progress" |
| `submittedAt` set | `success` "Answered" |

## Reactive State
```ts
const searchTerm = ref('')
const status = ref<PollStatus | undefined>()   // filter
const mineOnly = ref(false)
```
Feed the `usePollList` query variables.

## User Interactions
| Action | Result |
|---|---|
| Type in search | 300ms debounce → `search(searchTerm, status, mineOnly)` |
| Change status filter / toggle mine | immediate `search(...)` |
| Click poll row | `navigateTo('/tenant/tools/poll/{id}')` |
| New Poll → submit modal | `createPoll()` → `navigateTo('/tenant/tools/poll/{newId}')` |

## Empty state (UC8)
`UEmpty` — icon `i-lucide-vote` (verify UC11), label "No polls yet", a **New Poll** CTA.
