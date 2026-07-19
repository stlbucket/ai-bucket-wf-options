# Plan: Home dashboard redesign — simple lists + tenant/workspace context chips

> **Execution Directive:** Implement this plan via `/fnb-stack-implementor <this-file>`.
> The authoritative design handoff is `.claude/design-implementations/main-dashboard/readme.md`
> (high-fidelity written spec; the `.dc.html` mock is not present in the repo — the readme's
> layout/typography numbers are the source of truth). This plan sequences it and records
> verified code anchors; it does not restate the handoff. UI-only — no DB, no GraphQL, no
> codegen, no new dependencies. Never rebuild/restart the env yourself — home-app page edits
> hot-reload; if verification needs a restart, ask the user (memory `feedback_rebuild_ask_user`).

**Severity: MED** (design-handoff feature work) · Workstream: app/home-app · Planned: 2026-07-11
· Handoff status: final — all review toggles decided (`twoColumns: true`, `showDividers: true`),
no open questions.

## Context

The logged-in dashboard (`apps/home-app/app/pages/index.vue`) currently renders a flat card
grid of every granted tool (cycled `borderTopColor` accents, dashed "+ more tools as granted"
placeholder). The handoff replaces the cards with icon + label **list rows grouped by module**
(one labeled section per `availableSections` entry) and adds a **tenant / workspace context
chip row** under the greeting. Scope is exactly one file, logged-in branch only; the logged-out
hero, greeting block, session-expired toast, and `UEmpty` zero-module state are unchanged. The
sidebar (`AppNav.vue`) is context only — no changes.

## Verified code anchors (2026-07-11)

- Target file: `apps/home-app/app/pages/index.vue` (105 lines) — logged-in branch `:24-73`;
  card grid to drop `:38-65` (incl. dashed placeholder `:59-64`); `UEmpty` keep `:67-72`;
  toast logic keep `:82-95`; `accents` array `:98` (keep — reused for row icons); flat
  `tools` computed `:101` (replace with per-section iteration + a global row-accent index);
  `firstName` `:103` (keep).
- Nav data: `packages/tenant-layer/app/composables/useAppNav.ts` — `availableSections`
  (`NavSection { key, label, icon, ordinal, items: NavItem[] }`; `icon` = module
  `defaultIconKey`; sections sorted by ordinal at `:43`; items carry `label/icon/route`).
  Iterate it directly — do not re-sort.
- Claims: `packages/fnb-types/src/profile-claims.ts` — `tenantName`, `residentId`,
  `residencies: ResidencyTreeNode[] | null` (GraphQL claims path populates it; localStorage
  via `useAuth()`). `ResidencyTreeNode` (`packages/fnb-types/src/residency-tree.ts`):
  `tenantId, tenantName, tenantType, parentTenantId, residentId`. `TenantType` includes
  `'WORKSPACE'` (`tenant.ts:6`).
- Workspace-derivation precedent: `packages/auth-ui/src/use-residency-switcher.ts:31`
  (current node = `residencies` entry whose `residentId === user.residentId`; parent lookup
  by `parentTenantId`). This page derives display names only — no switch behavior.
- Tokens (already established, light + dark): `packages/auth-layer/app/assets/css/main.css`
  — `--paper`→`--ui-bg` (`bg-default`), `--paper-alt`→`--ui-bg-muted`, `--line`→`--ui-border`,
  `--ink-soft`→`text-muted`, `--ink-faint`→`text-dimmed`; handoff row-divider
  `oklch(0.93 0.006 250)` ≈ `--ui-border-muted` (`border-muted`, dark-aware) — use it, don't
  hardcode the oklch. Accent mapping: `--blue`→`var(--ui-primary)`, `--green`→
  `var(--ui-secondary)`, `--warn`→`var(--ui-warning)` (the existing `accents` array `:98`).
- Icons (UC11, verified real lucide names): `i-lucide-building-2`, `i-lucide-layers`,
  `i-lucide-package-open` (existing); module/tool icons come from nav data.

## Implementation — single phase, one file

`pnpm build` is the gate (repo lint broken — memory `project_eslint_broken`).

1. **Container:** logged-in wrapper `:26-28` → `mx-auto max-w-[760px]` (handoff overrides the
   UC12 hub width — high-fidelity handoff wins), padding ~44px/48px at desktop
   (`p-9 sm:px-12 sm:py-11`), keep `space-y-7`-scale rhythm per handoff gaps.
2. **Context chip row** (new, 14px below greeting block, `flex flex-wrap items-center gap-2`):
   - Script: `currentResidency = residencies.find(r => r.residentId === user.residentId)`;
     workspace context exists when `currentResidency?.tenantType === 'WORKSPACE'` **and** the
     parent node (`tenantId === currentResidency.parentTenantId`) resolves. Then: chip 1 =
     parent `tenantName`, chip 2 = current `tenantName` (≈ `user.tenantName`). No workspace
     context: chip 1 = `user.tenantName`, no separator, no chip 2. `user.tenantName` null →
     hide the whole row (handoff allows hide or `—`; hide is cleaner).
   - Chip styling (both chips, color differs): `inline-flex items-center gap-[7px] rounded-md
     px-2.5 py-[5px] font-mono text-xs font-semibold`, tenant chip `text-primary bg-primary/8
     border border-primary/18`, workspace chip same in `secondary`; `UIcon` 13px
     (`size-[13px]`) — `i-lucide-building-2` / `i-lucide-layers`. Separator `/` `font-mono
     text-xs text-dimmed`. Display-only, no click behavior, no new state.
3. **Module sections** (replace card grid `:38-65`; drop the dashed placeholder entirely):
   grid `grid-cols-[repeat(auto-fit,minmax(300px,1fr))]`, `gap-y-9 gap-x-12 items-start`
   (auto-collapses to one column narrow — no breakpoint classes needed). One `<section>` per
   `availableSections` entry (`v-if="availableSections.length"` replaces `tools.length`):
   - Header row: `flex items-center gap-2.5 pb-2` — `UIcon :name="s.icon"` `size-[15px]`
     colored with the **module's fixed accent** = `accents[sectionIndex % accents.length]`
     (Tools→primary, Admin→secondary, matching the handoff); label `font-mono text-[11px]
     font-bold uppercase tracking-[0.08em] text-muted`; zero-padded count
     (`String(s.items.length).padStart(2, '0')`) `font-mono text-[11px] font-semibold
     text-dimmed`; hairline `h-px flex-1 bg-(--ui-border)`.
   - Tool rows: `NuxtLink :to="item.route" :external="true"` — `flex items-center gap-3
     rounded-lg p-2.5 -mx-2.5 border-b border-muted last:border-0 hover:bg-default`
     (hover surface outdents via the negative margin; text stays header-aligned). `UIcon
     :name="item.icon"` `size-[18px] shrink-0` colored with the **global** cycled accent;
     label `text-[15px] font-medium`; trailing `→` `ml-auto text-[13px] text-dimmed`.
   - **Global row-accent index** (does NOT reset per module): computed offsets —
     `rowIndex(si, ii) = availableSections[0..si-1].items.length summed + ii`;
     `accents[rowIndex % 3]`. Keep it a small helper, not inline arithmetic in the template.
4. **Unchanged:** greeting block, `UEmpty` (`i-lucide-package-open`), session-expired toast,
   logged-out hero, `accents` values. Remove the now-dead `tools` computed.
5. Dark mode: nothing bespoke — all colors route through `--ui-*` tokens / Tailwind opacity
   modifiers (`bg-primary/8` uses color-mix, reads correctly on dark paper).

## Verification (read-only)

1. Root `pnpm build` green (gate).
2. home-app hot-reloads page edits (it's an app, not a layer). Visual check as a logged-in
   user with modules: sections render grouped with headers (icon-accent per module, zero-padded
   counts, hairline), rows navigate (full-page, `external`), hover surface outdents, dividers
   between rows only, two columns wide / one narrow, chip row shows tenant (and workspace +
   `/` only inside a workspace — enter one via the workspace switcher to check), greeting +
   empty state + `?session=expired` toast unchanged. Check dark mode via the color-mode toggle.
   (MCP browser can't reach localhost — memory `project_zitadel_login_e2e_curl`; ask the user
   to eyeball it or verify via their browser.)

## Out of scope

- `AppNav.vue` / sidebar (exists, unchanged).
- Residency switcher behavior (chips are display-only).
- The other design handoffs under `.claude/design-implementations/`.
