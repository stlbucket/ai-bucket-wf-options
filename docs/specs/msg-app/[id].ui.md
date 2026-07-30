# msg-app/[id] — Topic Detail UI

## Status
Implemented — reverse-engineered from the existing codebase.

## Route
`/messages/[id]` → `packages/msg-layer/app/pages/messages/[id].vue`

## Required Permission
`p:discussions`

## Layout
- Back button → `/messages` (`i-lucide-arrow-left`, ghost/neutral)
- Topic name heading (`text-xl font-semibold`)
- Scrollable `<MessageThread :messages="messages" />` (flex-1, overflow-y-auto)
- `<MessageComposer :topic-id="topicId" />` pinned at bottom (border-t)

## Component: `MessageThread.vue`
`packages/msg-layer/app/components/MessageThread.vue`

Props: `messages: Message[]`

Each message renders as a bordered card:
- `createdAt` formatted as `toLocaleString()` (text-xs, muted)
- `content` (text-sm, whitespace-pre-wrap)

Empty state: "No messages yet. Be the first to post!"

**Known Gap:** Prop typed as `Message[]` but receives `MessageWithSender[]` at runtime. `senderDisplayName` is available but not displayed — no sender attribution shown in the current UI.

## Component: `MessageComposer.vue`
`packages/msg-layer/app/components/MessageComposer.vue`

Props: `topicId: string`

- `<UTextarea>` (2 rows, flex-1) with placeholder "Write a message…"
- Send button (`i-lucide-send`, disabled until content is non-empty, shows loading while sending)
- Keyboard shortcuts: Ctrl+Enter / Cmd+Enter to send
- Shows error toast on failure

**Note:** This component calls `$fetch` directly — this is an intentional exception to R2 (do not copy this pattern for other components).

## User Interactions
| Action | Trigger | Condition |
|---|---|---|
| Go back | Click back button | always |
| Send message | Click send button or Ctrl/Cmd+Enter | content non-empty |
| Receive new message | WebSocket push | automatic, no user action |
