# msg/index — Topic List / Inbox UI

## Status
Implemented

## Route
`/tenant/msg` → `apps/tenant-app/app/pages/msg/index.vue`

## Required Permission
`p:discussions`

## Layout
- Header
- Search bar (client-side filter)
- `MsgTopicList.vue` table

## Component: `MsgTopicList.vue`
Props: `topics: SubscribedTopicSummary[]`

- Sortable table via `@tanstack/vue-table`
- Columns: topic name + participant names, last message date (locale format), read/unread badge
- Badge: info (blue) = unread, neutral = read
- Each row links to `/msg/{topicId}`

## Search
Client-side — filters by topic name or participant names (no server round-trip).

## "New Message" Modal
Triggered by "New Message" button. Fields:
- Participant multi-select (all tenant residents, current user excluded)
- Topic name (optional)
- Initial message (required)

Submit → `POST /api/topics` → redirect to `/msg/{newTopicId}`

## User Interactions
| Action | Trigger |
|---|---|
| Filter | Type in search bar |
| Open conversation | Click topic row |
| Create conversation | "New Message" button → fill modal → submit |
