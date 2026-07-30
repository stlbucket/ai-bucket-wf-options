# msg-app/index — Topic List UI

## Status
Implemented — reverse-engineered from the existing codebase.

## Route
`/messages` → `packages/msg-layer/app/pages/messages/index.vue`

## Required Permission
`p:discussions`

## Layout
- Header row: "Discussions" heading + "New Topic" `<UButton icon="i-lucide-plus">`
- `<TopicList :topics="topics" />`
- "New Topic" button opens a `<UModal>` with topic name input + Create/Cancel buttons

### New Topic Modal
- `<UFormField label="Topic name" required>` with `<UInput>`
- Create button (disabled until name is non-empty, shows loading spinner while creating)
- Cancel button closes modal
- After successful create: modal closes, topic list refreshes

## Component: `TopicList.vue`
`packages/msg-layer/app/components/TopicList.vue`

Props: `topics: Topic[]`

Each topic renders as a `<NuxtLink>` card to `/messages/{id}`:
- Topic name (font-medium)
- `createdAt` formatted as `toLocaleDateString()`
- Status badge (open=info, closed/locked=neutral)
- `i-lucide-chevron-right` icon

Empty state: plain text "No topics yet. Start a new discussion!"

**Status badge colors:**
| Status | Color |
|---|---|
| open | info |
| closed, locked | neutral |

## User Interactions
| Action | Trigger |
|---|---|
| View topic | Click topic card |
| Open create modal | Click "New Topic" button |
| Create topic | Click Create in modal (name required) |
| Cancel | Click Cancel in modal |

## Known Gaps
- `TopicList.vue` prop is typed as `Topic[]` but receives `SubscribedTopicSummary[]` at runtime — `lastMessageAt`, `isUnread`, and `participantNames` fields are available but not reflected in the type annotation or displayed in the UI.
