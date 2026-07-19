# Handoff: Msg Component Redesign

## Overview
Redesign of the shared message-thread component `apps/tenant-app/app/components/Msg.vue` (Nuxt 3 + Nuxt UI). It renders a topic's messages plus a composer, and is embedded in several contexts (todo discussion rail via `TodoMsg.vue`, msg pages, topic lists). The redesign replaces the current bordered-card-per-message look with a lighter avatar + meta-line + body layout that works in narrow rails (~312px) and full-page views, and fixes the current stray `header` text / debug leftovers.

This matches the Discussion block designed for the todo detail redesign (option 2a's right rail) — same tokens and language as the `todo-detail-redesign` and `ticket-detail-redesign` handoffs.

## About the Design Files
`Todo Detail Layouts.dc.html` is a **design reference created in HTML**, not production code. The Msg design is the **"Discussion" block inside option 2a's right rail** (top section of the file; also present in 1a/1b). Recreate it in the existing codebase with its established components (`UCard`, `UTextarea`, `UButton`, `UEmpty`) and semantic tokens.

## Fidelity
**High-fidelity** for the message rows, composer, and empty state. The surrounding card/header is context-dependent (see Variants).

## Target Files (branch `begin-discussion`)
- `apps/tenant-app/app/components/Msg.vue` — the component itself
- `apps/tenant-app/app/components/todo/TodoMsg.vue` — embeds it (empty state already close to spec)
- Callers passing `hideHeader` — API unchanged

## Component Spec

### Message row
Vertical list, `gap: 10px`. Each message (no border, no card):
- Layout: `flex; gap: 8px` — avatar left, content right.
- **Avatar**: 24px circle, participant-tinted — background = participant color at ~10% (e.g. blue-50 `#eff6ff`), text = participant color (e.g. blue-700 `#1d4ed8`); initials 10px / 600. Derive both from the existing `PARTICIPANT_COLORS` assignment (first-appearance order), using a light/dark pair per color (Tailwind 50/700 equivalents).
- **Meta line**: sender name 11px / 600 / gray-700 (`#374151`) — shows "You" for `currentResidentId` (existing `senderLabel`); timestamp 11px / gray-400 (`#9ca3af`), relative format preferred ("45m", "2h", falls back to date). Do **not** color the name/timestamp text — the tint lives in the avatar only.
- **Body**: 13px / 1.45 line-height / gray-700, `whitespace-pre-wrap`.
- Consecutive messages from the same sender within ~5 min may collapse (omit avatar + meta) — optional nicety.

### Composer
Bottom of the thread, pinned with `margin-top: auto` when the container is a column (rail):
- Input: 1px border gray-300 (`#d1d5db`), rounded 6px, `padding: 7px 10px`, placeholder "Reply…" (rail) / "Write a message…" (full page), 12–13px. Keep `UTextarea` with Cmd+Enter to send.
- **Send** button: emerald `#059669` solid (primary), white text 12px / 500, rounded 6px; keep icon-only `i-lucide-send` variant where space is tight, with loading/disabled states as today.
- Row layout: `flex; gap: 6px`, input `flex: 1`, button `self-end`.

### Empty state
One line, no dead vertical space (replaces `UEmpty`'s tall block in embedded contexts):
- "No discussion yet." (12px gray-400) + "Start discussion" outline button (`UButton variant="outline" color="neutral" size="xs"`) — in `TodoMsg` this opens `MsgNewConversationModal` as today.
- On full-page contexts, keeping `UEmpty` is acceptable.

### Scrolling
Keep the auto-scroll-to-bottom behavior (`threadEl` / watch on message count); the thread container is the scrollable region (`overflow-y: auto`), composer stays visible below it. Remove the commented-out debug wrapper.

## Variants
- **Rail / embedded** (`hideHeader`): no card chrome — the parent supplies the section label ("DISCUSSION", 11px / 600 / uppercase / 0.05em / gray-400). Component renders thread + composer only.
- **Full page**: wrap in `UCard`; header = topic name (16px / 600, not the current `text-xl` + stray "header" literal text — remove that).

## Interactions & Behavior
- Send: unchanged (`sendMessage`, clear input, toast on failure handled by callers).
- Participant colors: keep first-appearance assignment from `PARTICIPANT_COLORS`; map each hex to a (bg-tint, text) pair for avatars. Raw hex is fine here per the existing code comment.
- Hover: none required on rows; Send hover darkens ~5%.

## State Management
Unchanged: `content`, `sending`, `messages`/`topic` from `useMsgTopic`. No new state.

## Design Tokens
- Text: gray-700 `#374151` (names, body), gray-400 `#9ca3af` (timestamps, placeholder)
- Avatar pairs (bg / text): blue `#eff6ff`/`#1d4ed8`, green `#ecfdf5`/`#047857`, purple `#f5f3ff`/`#6d28d9`, orange `#fff7ed`/`#c2410c`, pink `#fdf2f8`/`#be185d`, teal `#f0fdfa`/`#0f766e`, yellow `#fefce8`/`#a16207`, rose `#fff1f2`/`#be123c` — one pair per existing `PARTICIPANT_COLORS` entry, same order
- Primary: emerald `#059669` (Send)
- Borders: gray-300 `#d1d5db` (input), gray-200 `#e5e7eb` (card contexts)
- Radii: 6px input/buttons, full avatars
- Type: 11px meta, 13px body / 1.45

## Assets
None new. Icons: `i-lucide-send`, `i-lucide-message-square` (full-page empty state only).

## Files
- `Todo Detail Layouts.dc.html` — open in a browser; the Msg design is the **Discussion block in option 2a's right rail** (top of page). The `hasDiscussion` tweak previews the one-line empty state.
