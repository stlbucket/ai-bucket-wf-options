# Handoff: Todo Detail Redesign

## Overview
Redesign of the todo detail page in `apps/tenant-app` (Nuxt 3 + Nuxt UI). Replaces the current layout — where description, assignee, subtasks, location, attachments, and actions are crammed into one narrow left column with an empty right third — with:

- **Desktop (option 2a)**: metadata (status, assignee, location) inline under the title; a full-width main column for description + subtask tree; and a **collapsible right rail** containing Attachments stacked over Discussion. Rail state persists.
- **Mobile (option 1d)**: single stacked column; meta chips wrap; the rail becomes collapsed accordion rows at the bottom.

## About the Design Files
`Todo Detail Layouts.dc.html` is a **design reference created in HTML** — a prototype showing intended look and behavior, not production code. The task is to **recreate the design in the existing Nuxt 3 / Nuxt UI codebase** (`apps/tenant-app`), reusing its existing components (`UCard`, `UButton`, `UBadge`, `UDropdownMenu`, `UPopover`, `USelectMenu`, `UModal`, lucide icons, `statusColor`/`statusLabel` helpers) rather than the raw hex values below wherever a Nuxt UI semantic token exists.

The file contains several options. **Implement option `2a` (desktop) and `1d` (mobile).** Options 1a/1b/1c are earlier explorations — ignore them.

## Fidelity
**High-fidelity.** Layout, hierarchy, spacing, and interactions are final intent. Colors map to Nuxt UI semantic tokens (see Design Tokens); use the codebase's tokens, not hardcoded hex, where equivalents exist.

## Target Files (current code, branch `begin-discussion`)
- `apps/tenant-app/app/components/todo/TodoDetail.vue` — main restructure
- `TodoDetailStatus.vue` — unchanged behavior, moves into meta row
- `TodoDetailAssign.vue` — becomes inline chip + change affordance
- `TodoDetailLocation.vue` — becomes inline chip + map popover
- `TodoDetailActions.vue` — becomes a `UDropdownMenu` (⋯)
- `TodoDetailBadges.vue` — shrinks to badges only (pin moves to ⋯ menu)
- `TodoDetailSubtasks.vue` — keep tree; add status dots + progress counters
- `TodoDetailAttachments.vue` — moves into right rail (compact rows)
- `TodoMsg.vue` — moves into right rail; empty state already correct

## Screens / Views

### 1. Todo Detail — Desktop (option 2a in the design file)

**Header** (card header, `padding: 18px 24px 14px`, bottom border, vertical stack `gap: 10px`):
1. **Breadcrumb** — existing `TodoDetailBreadcrumb`; 12px, gray-400/500.
2. **Title row** — flex, space-between:
   - Left: todo name (20px / 600 / gray-900), `milestone` badge (`UBadge color="info" variant="subtle"`), `pinned` badge (neutral outline). Gap 10px.
   - Right (flex gap 8px):
     - **Rail toggle button** (`UButton variant="outline" color="neutral" size="sm"`). Label shows live counts: `Attachments {n} · Discussion {m}` with a caret: `… ▸` when rail is open (click hides), `◂ …` when closed (click shows). Whitespace nowrap.
     - **⋯ overflow menu** (`UDropdownMenu`): "Make template" (or "Clone from template" when `isTemplate`), "Pin"/"Unpin", divider, "Delete…" (red, opens existing confirm `UModal`).
3. **Meta row** — flex, `gap: 14px`, wrap, items separated by 1px × 18px vertical dividers (`bg-gray-200`):
   - **Status pills** — existing `TodoDetailStatus` component unchanged: active pill solid (statusColor), inactive pills neutral outline. Gap 6px.
   - **Assignee** — 22px avatar circle with initials (emerald-50 bg / emerald-700 text, 10px / 600) + display name (13px gray-700) + "change" link (11px gray-400, underline) that reveals the existing `USelectMenu` assign control (wrap in `UPopover`).
   - **Location chip** — 13px pin icon (`i-lucide-map-pin`) + place name with dotted underline (13px gray-700). Click opens a **`UPopover`**: 260px wide, 130px map preview on top (real map embed or placeholder), then a row with place name (12px / 600) + coordinates in monospace (10px gray-400) + "Change" link (11px, primary). Only render the chip if the todo has a location.

**Body** — `flex`, min-height to fill:
- **Main column** — `flex: 1; min-width: 0; padding: 20px 24px`, vertical stack `gap: 24px`:
  - **Description** — section label (11px / 600 / uppercase / letter-spacing 0.05em / gray-400, margin-bottom 8px) + body text (14px / 1.6 line-height / gray-700, `max-width: 62ch`). Keep existing inline-edit behavior.
  - **Subtasks** — header row: label + total progress `2/6 done` (11px monospace gray-500) left; "+ Add subtask" `UButton outline size="xs"` right. Below, the tree in a bordered rounded-lg container:
    - **Row**: flex, `gap: 10px`, `padding: 9px 12px`, 1px bottom border gray-100.
    - **Status indicator** (replaces the status text badge): 16px circle —
      - COMPLETE: filled emerald `#059669` (`--ui-success`) with white check
      - INCOMPLETE: 2px gray-300 ring, empty
      - UNFINISHED: 2px amber `#d97706` dashed ring
    - Name (13px, 500 weight top-level / 400 nested, links to `/tools/todo/{id}`), owner pill (11px, gray-100 bg, rounded-full, e.g. "Priya P."), spacer, per-parent progress `1/2` (11px monospace gray-400), ghost `+` add-subtask button (visible on hover is fine).
    - **Nesting**: child rows indent `padding-left: 36px` per level with `bg-gray-50`; deepest visible level shows `+{hiddenChildren.totalCount} more`. Keep existing 3-level depth + add-subtask modal.
- **Right rail** — `v-if="railOpen"`, `width: 312px` (`w-80` ≈ 320px is fine), `flex-shrink: 0`, left border, `bg-gray-50` (`bg-muted`), `padding: 18px`, vertical stack `gap: 20px`:
  - **Attachments** — section label "ATTACHMENTS · {n}" + "Upload" link (11px, primary) right. File rows: white card, 1px border, rounded-lg, `padding: 7px 10px`, gap 9px — 30px rounded square file-type chip (text "PDF"/"PNG"/etc., 9px / 700; tinted bg: PDF red-100/red-700, audio violet-100/violet-700, image green-100/green-700), filename (12px / 500, truncate), meta line (10px gray-400: size · uploader).
  - **Discussion** — section label; then either:
    - existing `Msg` thread: messages as 24px avatar + author/time line (11px) + body (13px / 1.45), reply input + primary "Send" button pinned to rail bottom (`margin-top: auto`); or
    - **empty state (one line, no dead space)**: "No discussion yet." (12px gray-400) + "Start discussion" outline button (opens existing `MsgNewConversationModal`).

### 2. Todo Detail — Mobile (option 1d in the design file, < `lg`)
- Single column; header `padding: 16px`.
- Breadcrumb collapses to `‹ {parent name}`.
- Title 18px; badges wrap next to it.
- Meta chips wrap in a row, each **min-height 32px** (≥44px total hit area with padding is preferred): status as a **dropdown pill** (current status + `▾`, tinted by statusColor) instead of the four-pill group; assignee chip; location chip.
- Description, then subtasks (same rows, `padding: 11px 12px` for larger hit targets; truncate names).
- Rail becomes **accordion rows at the bottom**: "▸ Attachments {n}" and "▸ Discussion {n} · {last reply time}" — bordered rounded rows, `bg-gray-50`, expanding in place. Empty discussion shows "Start discussion" in the row.
- Implementation: `flex-col lg:flex-row` on the body; `aside` = `hidden lg:flex` and render the accordion pair `lg:hidden`, or one component with two presentations.

## Interactions & Behavior
- **Rail toggle**: button in title row toggles `railOpen`; main column reflows to full width when hidden. Persist per user: `const railOpen = useLocalStorage('todo-detail-rail-open', true)` (VueUse) or ref + watch → localStorage.
- **Button counts**: attachments count from the attachments service; discussion count from `useTodoMsg` (expose message count, or fall back to showing just "Discussion" when `hasTopic`).
- **⋯ menu**: replaces the `TodoDetailActions` button row. Delete keeps the existing confirmation modal. Pin/Unpin moves here from `TodoDetailBadges`.
- **Location popover**: opens on chip click, closes on outside click. "Change" opens location picker (future).
- **Map popover on mobile**: use a `UModal`/slideover instead of popover.
- **Status change, assign, add-subtask, template actions**: identical emits/handlers as today — this is layout-only for those.
- **Hover states**: outline buttons → `bg-gray-50`; menu items → `bg-gray-100` (delete → `bg-red-50`); subtask row `+` appears on row hover.
- No new animations required; rail show/hide may be instant or a 150ms width/opacity transition.

## State Management
- `railOpen: boolean` — persisted to localStorage, default `true`.
- `menuOpen`, `mapPopoverOpen` — handled by `UDropdownMenu`/`UPopover` internally.
- Mobile accordions: `attachmentsOpen`, `discussionOpen` booleans, default closed.
- No changes to data fetching; counts derive from existing queries (`todoTree`, attachments list, msg topic).

## Design Tokens (map to Nuxt UI semantic tokens where they exist)
- Text: gray-900 `#111827` (headings), gray-700 `#374151` (body), gray-500 `#6b7280`, gray-400 `#9ca3af` (labels/meta)
- Borders: gray-200 `#e5e7eb`; row separators gray-100 `#f1f3f5`
- Surfaces: white; rail/nested rows `#fafafa` (`bg-muted`)
- Primary/success: emerald `#059669` (send button, complete dot, links like Upload/Change)
- Status: Incomplete amber `#d97706`; Complete emerald `#059669`; Unfinished amber dashed; Archived neutral — defer to existing `statusColor('todo', …)`
- Milestone badge: blue-100 `#dbeafe` / blue-700 `#1d4ed8` (= `UBadge color="info" variant="subtle"`)
- Radii: 6px buttons/badges, 8px cards/rows, full for avatars/pills
- Section labels: 11px / 600 / uppercase / 0.05em tracking
- Monospace accents (counts, coordinates): `ui-monospace` 10–11px
- Popover/menu shadow: `0 8px 24px rgba(17,24,39,0.12)`

## Assets
No new assets. Icons are existing lucide set (`i-lucide-map-pin`, `i-lucide-plus`, `i-lucide-ellipsis`, `i-lucide-upload`, `i-lucide-trash-2`, `i-lucide-pin`). File-type chips are styled text, not icons. Map preview: any static map/tile embed; the design uses a placeholder.

## Files
- `Todo Detail Layouts.dc.html` — interactive design reference. Open in a browser. **Option 2a** (top section) = desktop target; **option 1d** (bottom section, 390px card) = mobile target. 2a's rail toggle, ⋯ menu, and map popover are functional in the prototype.
