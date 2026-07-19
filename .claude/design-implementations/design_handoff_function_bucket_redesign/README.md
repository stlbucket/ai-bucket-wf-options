# Handoff: function-bucket UI Redesign ("Cascadia" visual direction)

## Overview
A full visual redesign of the **function-bucket** platform (repo: `stlbucket/ai-bucket`, branch: `begin-discussion`) — a multi-tenant Nuxt 4 + Nuxt UI v4 app with todos, messaging, locations, support tickets, and tenant/license/user administration. The redesign replaces the stock Nuxt UI look with a branded "cascadia" identity: deep blue + forest green, a persistent dark sidebar, monospace brand accents, and humanized status badges. It covers 21 desktop screens, 4 mobile layouts, and a global dark mode.

## About the Design Files
The file in this bundle (`function-bucket-redesign.dc.html`) is a **design reference created in HTML** — a prototype showing intended look and behavior, **not production code to copy directly**. The task is to **recreate these designs in the existing Nuxt 4 / Nuxt UI v4 / Tailwind codebase** using its established patterns (UCard, UTable, UBadge, UButton, UModal, app.config.ts theming). Where the mock shows a hand-drawn element (sidebar, badges), map it to the closest Nuxt UI primitive and restyle via theme config, not one-off CSS.

## Fidelity
**High-fidelity.** Colors, typography, spacing, and copy are intentional. Recreate pixel-faithfully **via the codebase's existing component library** — the goal is that existing components inherit this look through theming plus targeted layout changes, not a parallel component set.

## Design Tokens
All colors are OKLCH (Tailwind v4 supports these natively). Suggested Nuxt UI mapping: `primary` → blue, `secondary`/`success` → green.

Light mode:
- `--blue: oklch(0.42 0.11 248)` — primary actions, links, active states
- `--blue-ink: oklch(0.30 0.10 248)` — sidebar background, dark headings
- `--blue-light: oklch(0.94 0.025 248)` — selected-row background, info badge bg
- `--blue-line: oklch(0.82 0.05 248)` — selected borders
- `--green: oklch(0.48 0.11 155)` — brand mark, positive CTAs ("+ New")
- `--green-ink: oklch(0.34 0.10 155)` — success badge text
- `--green-light: oklch(0.94 0.03 155)` — success badge bg
- `--warn: oklch(0.68 0.13 75)` / `--warn-light: oklch(0.95 0.04 75)` — warning badge text/bg
- `--danger: oklch(0.55 0.16 25)` / `--danger-light: oklch(0.95 0.04 25)` — error badge text/bg
- `--ink: oklch(0.24 0.012 250)`; `--ink-soft: oklch(0.50 0.012 250)`; `--ink-faint: oklch(0.66 0.010 250)`
- `--paper: oklch(0.99 0.003 250)` (cards); `--paper-alt: oklch(0.965 0.006 250)` (page bg); `--line: oklch(0.90 0.008 250)` (borders)

Dark mode (toggle in the mock's header applies these):
- `--blue: oklch(0.72 0.10 248)`; `--blue-ink: oklch(0.20 0.05 248)`; `--blue-light: oklch(0.28 0.06 248)`; `--blue-line: oklch(0.40 0.08 248)`
- `--green: oklch(0.68 0.11 155)`; `--green-ink: oklch(0.62 0.12 155)`; `--green-light: oklch(0.26 0.06 155)`
- `--warn: oklch(0.75 0.13 75)` / `--warn-light: oklch(0.28 0.07 75)`; `--danger: oklch(0.68 0.15 25)` / `--danger-light: oklch(0.28 0.08 25)`
- `--ink: oklch(0.95 0.005 250)`; `--ink-soft: oklch(0.75 0.01 250)`; `--ink-faint: oklch(0.55 0.012 250)`
- `--paper: oklch(0.23 0.01 250)`; `--paper-alt: oklch(0.18 0.01 250)`; `--line: oklch(0.33 0.014 250)`; page bg `oklch(0.14 0.008 250)`

Typography:
- UI text: system stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`)
- Brand accent: **JetBrains Mono** (500/600/700, Google Fonts) — wordmark, section labels, identifiers/IDs, dashboard greeting ("hey, jordan."), nav section headers
- Scale: page titles 22px/700; card titles 15–18px/600–700; body 14px; secondary 12–13px; section labels 11px/700 uppercase tracking 0.05em; table headers 11px/700 uppercase; badges 11px/600
- Radii: cards/tables 10–12px; buttons/inputs 7–8px; badges 99px (pill); modal 14px
- Spacing: sidebar 232px fixed; content padding 36–44px; card padding 20–24px; table rows 13–14px vertical / 20px horizontal

## Global Layout System
Every desktop screen shares:
1. **Persistent sidebar** (232px, `--blue-ink` bg, white text) replacing the current slide-over nav (`packages/tenant-layer/app/components/AppNav.vue` + `useAppNav.ts`). Contents: brand row (green bucket SVG + "function-bucket" in JetBrains Mono 15px/700), nav sections ("Tools", "Admin" — 11px uppercase mono labels at 45% white), items (14px, 16px Lucide icon + label, 9px 10px padding, radius 8px; active = `rgba(255,255,255,0.14)` bg + weight 600), and a user row pinned to the bottom (26px green avatar circle + name).
2. **Content area** on `--paper-alt`, either full-width tables (padding 36px 44px) or centered single card (620–800px column).
3. **Icons**: Lucide (the codebase already uses `i-lucide-*`). The mock inlines equivalent stroke SVGs; use the real Lucide names: list-todo, message-square, map-pin, building-2, ticket, id-card, user, credit-card, layout-grid, pin, headphones, upload, image, file, trash-2, send.
4. **Badges**: pill, 11px/600, sentence case. Never render raw enums — map `INCOMPLETE→Incomplete`, `blocked_individual→Blocked`, etc. Color mapping matches existing `statusColor()` helpers: warning=incomplete/invited/paused, success=complete/active, neutral=archived/inactive, error=blocked/expired.

## Screens (21 desktop + 4 mobile)
All in `function-bucket-redesign.dc.html`, anchored by id. Source component each maps to is noted.

1. **Login** (`#login`) — `apps/auth-app/app/pages/login.vue`. Full-bleed `--blue-ink` backdrop, 400px centered card (radius 14px, 40px padding), blue bucket mark, mono "Sign in" title, email/password fields, right-aligned "Forgot password?" link, full-width blue submit. Includes the multi-residency "Choose a residency" picker (selected option = blue-light bg + blue-line border).
2. **Home dashboard** (`#home`) — `apps/home-app`. Mono greeting "hey, jordan." + "here's what's in your bucket"; 3-col grid of module cards: 3px colored top border (alternating blue/green/warn), 22px colored Lucide icon, 15px/600 title, 13px summary line, then a 12px `--ink-faint` preview line separated by a hairline (e.g. "Next: Repaint clubhouse trim — Fri"). Dashed "+ more tools as granted" placeholder card.
3. **Messaging** (`#msg`) — `Msg.vue`, `MsgTopicList.vue`. 340px topic list (selected = blue-light bg + 3px blue left border; unread pill) + conversation pane: sender name colored (blue-ink/green-ink per participant), bubbles `--paper` with 4px/12px asymmetric radius, own messages right-aligned solid blue/white, composer with pill input + Send.
4. **Todos split view** (`#todo`) — `TodoList.vue` + `TodoDetail.vue`. 380px list + detail pane (breadcrumb, title + pin icon, badges, status segmented buttons, assignee avatar, subtasks with inline badges).
5. **Tenants table** (`#tenants`) — `TenantList.vue`. Standard table treatment: header row 11px uppercase on `--paper-alt`, name cell blue/600, status badge, mono identifier, row action link.
6. **Licenses + assignment panel** (`#licenses`) — `LicenseList.vue`, `LicenseAssignment.vue`.
7. **Support tickets split view** (`#tickets`) — `TicketList.vue`, `SupportButton.vue`. Detail has quoted description card, activity timeline (avatar + text + timestamp), "Enter Support" blue button with headphones icon, internal-note composer + Close ticket.
8. **Tenant detail** (`#tenant-detail`) — `site-admin/tenant/[id].vue`. Centered 640px card: header (name + status + Support/Edit/Deactivate buttons), 140px-label key-value grid, mono IDs.
9. **Todo detail full page** (`#todo-detail`) — `tools/todo/[id].vue`. Adds **two new features not in the codebase**: a Location card (64px green-light icon tile + name/site + Change link) and Attachments (dashed blue-light dropzone "Drop files to upload…" + file rows: 36px icon tile, name 13px/600, meta 11px, Download action). These need schema/backend work — flag before building.
10. **New conversation modal** (`#new-convo`) — `MsgNewConversationModal.vue`. 460px modal on 45% scrim: participant chips (blue-light, removable ✕), topic name (defaults to participant names), first message textarea, Start Conversation/Cancel.
11. **Todo compact list** (`#todo-list-small`) — `TodoListSmall.vue`. Single 620px column, chevron rows.
12. **Users table** (`#users`) — `UserList.vue` (site admin).
13. **Residents table** (`#residents`) — `ResidentList.vue` (adds Type column).
14. **License assignment modal** (`#license-assign-modal`) — `LicenseAssignment.vue` re-presented as a per-resident modal ("Manage" row action) instead of an inline card. UX suggestion, 480px, scoped radios (pick one) + unscoped checkboxes (pick any) side by side, Done button.
15. **Subscriptions** (`#subscriptions`) — `admin/subscription/index.vue`. Card with Active/Inactive tab underline (2px blue), table with Deactivate outline-warning action.
16. **Locations table** (`#locations`) — `loc/index.vue`. Name/City/State/Country + trash action.
17. **New location form** (`#new-location`) — `loc/new.vue`. 620px card, name/address1/address2, City/State/Postal 3-col grid, country, separator, lat/lon 2-col.
18. **Applications table** (`#applications`) — `site-admin/application/index.vue`. Name / mono key / Enabled-Disabled badge.
19. **New support ticket** (`#new-ticket`) — `support/tickets/new.vue`. Title + description, required markers.
20. **Resident detail** (`#resident-detail`) — `admin/user/[id].vue`. Profile card (name + status + Block outline-danger) + License Assignments card.
21. **Platform user detail** (`#user-detail`) — `site-admin/user/[id].vue`. Two-column: left = Profile card (kicker label + name + status; Deactivate/Block/Edit actions; full key-value grid) and Auth Account card (Confirmed badge, role, sign-in dates); right = Residencies card (count badge, per-residency status + Activate/Deactivate).

**Mobile** (`#mobile`, iPhone frames): bottom tab bar (Home/Todos/Messages+unread-dot/Profile, 22px icons, 10px labels, active = blue) replaces the sidebar; Home becomes stacked full-width module rows with 3px colored left border and chevrons; compact todo list; conversation view (80% max-width bubbles, pill composer + circular send); todo detail (TodoDetailSmall's stacked sections).

## Interactions & Behavior
- Sidebar: active item highlighted per route; hover = subtle white overlay.
- Dark mode: single toggle swaps the token set above (implement as Tailwind `dark:` / Nuxt UI color mode; the mock's toggle shows expected results). Transition ~150ms on background-color.
- Tables: row hover = `--paper-alt`; first cell is the nav link (blue, 600).
- List/detail splits (todos, tickets): selected list row = blue-light bg + 3px blue left border.
- Modals: 45% scrim `oklch(0.2 0.01 250 / 0.45)`, radius 14px, shadow `0 24px 60px oklch(0 0 0 / 0.3)`.
- Status segmented control (todo detail): selected = solid status color, others outline.
- Existing behaviors (pin/unpin, block/unblock, grant/revoke, activate/deactivate, enter-support confirm) keep their current logic — only restyled.

## State Management
No new state beyond what existing composables provide, except:
- Color-mode preference (persisted, Nuxt color-mode module).
- New todo features (attachments upload state, location picker) — require new API/schema; treat as a separate feature ticket.

## Assets
- **Bucket logo**: inline SVG (three paths — arc handle, trapezoid body, rim bar), green on dark sidebar, blue on light login card. Source of truth: `apps/home-app/app/components/FunctionBucketMark.vue` / `packages/tenant-layer/app/components/AppLogo.vue`.
- **JetBrains Mono** via Google Fonts (weights 500/600/700).
- Icons: Lucide (already a codebase dependency).
- All names/data in the mock are placeholders.

## Screenshots
`screenshots/` contains one capture per screen, numbered to match the list above (01-login … 21-mobile). They show the browser-viewport rendering of each anchor; the HTML file remains the source of truth for exact values.

## Files
- `function-bucket-redesign.dc.html` — all screens; open in a browser. Nav links at top jump to each screen; dark-mode toggle below them.
- `browser-window.jsx`, `ios-frame.jsx`, `support.js` — mock chrome (browser/phone bezels and runtime). Not part of the design.

## Suggested implementation order
1. Theme tokens in `app.config.ts` / Tailwind config (blue/green palette, radii) — biggest win, zero layout risk.
2. Badge normalization: one shared status-label formatter + UBadge styling.
3. Sidebar: replace slide-over with persistent `AppNav` (desktop ≥1024px), bottom tabs on mobile.
4. Dark mode via color-mode module.
5. Per-screen layout adjustments (split views, centered card widths, dashboard card previews).
6. New features last (todo attachments, todo location) — backend + UI.
