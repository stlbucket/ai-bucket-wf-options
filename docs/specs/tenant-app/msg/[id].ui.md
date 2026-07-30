# msg/[id] — Conversation View UI

## Status
Implemented

## Route
`/tenant/msg/[id]` → `apps/tenant-app/app/pages/msg/[id].vue`

## Required Permission
`p:discussions`

## Layout
- Header with back button → `/msg`
- `<Msg :topicId :currentResidentId />` — full thread delegated to component

## Component: `Msg.vue`
`apps/tenant-app/app/components/Msg.vue`
Props: `topicId: string`, `currentResidentId?: string`

**Message thread:**
- Sender color coding: 8-color palette, consistent per sender within session
- Sender label: "You" for current resident, display name for others
- Timestamp on each message
- Whitespace preserved in content
- Auto-scrolls to bottom on new messages

**Composer:**
- Textarea input
- Ctrl+Enter / Cmd+Enter to send (or Send button)
- Disabled when content is empty

**Real-time:**
- New messages appear instantly via WebSocket — no manual refresh needed
- Reconnects automatically with 2-second backoff if connection drops

## User Interactions
| Action | Trigger |
|---|---|
| Send message | Type + Ctrl/Cmd+Enter, or Send button |
| Back to list | Back button in header |
