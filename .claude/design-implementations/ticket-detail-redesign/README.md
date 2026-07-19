# Handoff: Support Ticket Detail Redesign

## Overview
Redesign of the support ticket detail page (`apps/tenant-app/app/pages/support/tickets/[id].vue`, Nuxt 3 + Nuxt UI). Fixes the wasted space at the top — the header card, two side-by-side Tenant/Submitter cards, and the mid-page action-button row collapse into one compact header with inline meta. Adds **attachments in the same manner as the todo detail redesign**: a hideable right rail with persisted state. Comments become the main column.

This page shares its design language with the todo detail redesign (`todo-detail-redesign/` handoff, option 2a): same header anatomy, rail behavior, section labels, ⋯ overflow menu, and tokens. Implement them consistently — the rail + attachments UI should become shared components.

## About the Design Files
`Ticket Detail Layouts.dc.html` is a **design reference created in HTML** — a prototype showing intended look and behavior, not production code. Recreate it in the existing Nuxt 3 / Nuxt UI codebase using its established components (`UCard`, `UButton`, `UBadge`, `UDropdownMenu`, `UTextarea`, `UEmpty`, lucide icons, `statusColor`/`statusLabel`) and semantic tokens rather than raw hex where equivalents exist.

**Implement option `1a` (desktop) and `1b` (mobile).** Both are functional in the prototype: 1a's rail toggle (persists via localStorage) and ⋯ menu work; a `hasAttachments` tweak previews the empty rail.

## Fidelity
**High-fidelity.** Layout, hierarchy, spacing, and interactions are final intent; colors map to Nuxt UI tokens.

## Target Files (branch `begin-discussion`)
- `apps/tenant-app/app/pages/support/tickets/[id].vue` — full restructure (currently: back button → header UCard → 2-col Tenant/Submitter UCards → description UCard → action button row → USeparator → comments UCard, `max-w-3xl`)
- New/shared: attachments rail component (share with todo detail), rail-toggle button pattern
- `useSupportTicket` composable — unchanged API; attachments need a service (same one as todos)

## Screens / Views

### 1. Ticket Detail — Desktop (option 1a)

Full-width page (drop `max-w-3xl mx-auto`; the card spans the content area).

**Header** (`padding: 18px 24px 14px`, bottom border, stack `gap: 10px`):
1. **Back link** — `‹ Tickets` (12px, gray-500), replaces the ghost button row.
2. **Title row** — flex space-between:
   - Left: ticket title (20px / 600 / gray-900) + status badge (`UBadge :color="statusColor('ticket', status)" variant="subtle"`; e.g. `open` = amber-100 bg / amber-800 text). Gap 10px.
   - Right (flex gap 8px):
     - **Rail toggle** (`UButton variant="outline" color="neutral" size="sm"`): label `Attachments {n} ▸` when open, `◂ Attachments {n}` when closed.
     - **Primary contextual action** (outline button): the most likely action for the viewer/status — e.g. "Close ticket" for submitter/support on an open ticket; "Reopen" on closed.
     - **⋯ overflow menu** (`UDropdownMenu`): remaining actions, permission- and status-gated exactly as the current button row (`isSubmitter`, `canAdminAct`, status conditions): Park, Mark duplicate, Close/Reopen, divider, Delete… (red). Keep existing `doAction` handlers/toasts.
3. **Meta row** — flex `gap: 14px`, wrap, 1px × 18px divider between groups:
   - **Submitter**: 22px avatar circle (initials, blue-50 bg / blue-700 text, 10px / 600) + displayName (13px gray-700) + email (11px gray-400) + `↗` link to `/site-admin/user/{profileId}` (only when `canAdminAct`).
   - **Tenant**: label "TENANT" (11px / 600 / uppercase / gray-400) + name (13px gray-700) + tenant status badge (10px, e.g. `active` emerald subtle) + `↗` to `/site-admin/tenant/{tenantId}` (when `canAdminAct`).
   - **Opened date**: "Opened Jun 28, 2026" (13px gray-500).

**Body** — `flex; min-height` fills viewport:
- **Main column** (`flex: 1; min-width: 0; padding: 20px 24px`, stack `gap: 22px`):
  - **Description** — section label (11px / 600 / uppercase / 0.05em / gray-400, mb 8px) + `whitespace-pre-wrap` body (14px / 1.6 / gray-700, `max-width: 62ch`).
  - **Comments** — section label "COMMENTS" + count (11px monospace gray-500). Comment cards: 1px border, rounded-lg, `padding: 10px 14px`, stack gap 10px. Card contents: author name (12px / 600, colored by existing `commenterColor(residentId)` hash) + timestamp (11px gray-400) + optional `support` role chip (10px neutral outline) + body (13px / 1.5 gray-700, pre-wrap). Keep `UEmpty` when no comments.
  - **Composer** — pinned to column bottom (`margin-top: auto; padding-top: 16px`): `UTextarea` (3 rows, "Add a comment…") + right-aligned primary "Add comment" button (emerald solid). Hide when status is `deleted` (as today).
- **Attachments rail** — `v-if="railOpen"`, width 312px (`w-80` fine), `flex-shrink: 0`, left border, `bg-muted` (#fafafa), `padding: 18px`, stack gap 12px:
  - Header: "ATTACHMENTS · {n}" label + "Upload" link (11px, primary).
  - File rows (identical to todo redesign): white card, 1px border, rounded-lg, `padding: 7px 10px` — 30px rounded-square file-type chip (styled text "JPG"/"PDF", 9px / 700; image green-100/green-700, PDF red-100/red-700, audio violet-100/violet-700), filename (12px / 500, truncate), meta (10px gray-400: size · uploader).
  - **Drop zone** below files: 2px dashed gray-300, rounded-[10px], centered — "Drop files to upload" (12px / 500 gray-500) + "Photos, PDFs · up to 25 MB" (10px gray-400).
  - **Empty state**: drop zone only, copy "No attachments yet / Drop files here or click Upload" — no dead space.

### 2. Ticket Detail — Mobile (option 1b, < `lg`)
- Header `padding: 16px`: top row = `‹ Tickets` left, ⋯ button right (all actions incl. rail-equivalent live here or below); title 18px with status badge wrapping beside it; meta chips wrap (each min-height 32px): submitter chip (avatar + name), tenant chip, date text.
- Body single column: description → **Attachments accordion row** ("▸ Attachments {n}" + "Upload" link; bordered, rounded, `bg-gray-50`, expands in place to the same file rows + drop zone) → comments list → composer with full-width "Add comment" button (min-height 44px).
- Implementation: `flex-col lg:flex-row`; rail `hidden lg:flex`, accordion `lg:hidden`.

## Interactions & Behavior
- **Rail toggle**: `railOpen` persisted — `useLocalStorage('ticket-detail-rail-open', true)`. Main column reflows full-width when hidden. Button count updates live from the attachments query.
- **Action gating**: unchanged logic from the current page — submitter: Close (open/parked), Reopen (closed/duplicate/parked), Delete (not deleted); admin/support: Park (open), Mark duplicate (open/parked), Close (open/parked), Reopen (closed/parked/duplicate). Choose the primary visible button as the first applicable action; the rest go in ⋯. Keep toasts.
- **Upload**: "Upload" link and drop zone use the same attachments service as todo detail (drag-drop + click-to-browse). Show per-file progress inline in a file row skeleton if available.
- **Comment colors**: keep the existing `commenterColor` hash mapping to Nuxt UI text color classes.
- **Hover**: outline buttons → `bg-gray-50`; menu items → `bg-gray-100` (Delete → `bg-red-50`).
- **Loading / not-found**: keep existing `fetching` and "Ticket not found" states.

## State Management
- `railOpen: boolean` — localStorage-persisted, default true (desktop only).
- `attachmentsOpen: boolean` — mobile accordion, default closed.
- `newComment`, `commentSubmitting` — unchanged.
- Menu open state via `UDropdownMenu`.
- Attachments list: new query via the shared attachments service, keyed by ticket id.

## Design Tokens (same system as todo-detail-redesign)
- Text: gray-900 `#111827`, gray-700 `#374151`, gray-500 `#6b7280`, gray-400 `#9ca3af`
- Borders: gray-200 `#e5e7eb`; separators `#f1f3f5`
- Surfaces: white; rail `#fafafa` (`bg-muted`)
- Primary/success: emerald `#059669` (Add comment, Upload link)
- Ticket status: `open` amber-100/`#92400e`; others via `statusColor('ticket', …)`
- Tenant `active` badge: emerald-50 `#ecfdf5` / `#047857`
- Radii: 6px buttons/badges, 8px cards/rows, 10px drop zone, full avatars
- Section labels: 11px / 600 / uppercase / 0.05em tracking; counts in `ui-monospace` 11px
- Menu/popover shadow: `0 8px 24px rgba(17,24,39,0.12)`
- Dashed drop zone: 2px dashed `#d1d5db`

## Assets
No new assets. Icons: existing lucide set (`i-lucide-arrow-left`, `i-lucide-ellipsis`, `i-lucide-upload`, `i-lucide-arrow-up-right`). File-type chips are styled text.

## Files
- `Ticket Detail Layouts.dc.html` — interactive design reference; open in a browser. **1a** = desktop, **1b** = mobile. Rail toggle, ⋯ menu, and the `hasAttachments` tweak are functional.
