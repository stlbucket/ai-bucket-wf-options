# site-admin/user — Platform User Search

> **Execution Directive:** plan + build this spec via
> `/fnb-stack-implementor docs/specs/tenant-app/site-admin/user/README.md` —
> the implementor derives the `docs/issues/` plan file (R23) from the task list below,
> then executes it.

## Status
Implemented — GraphQL. Search + pagination landed 2026-07-27 via plan
`docs/issues/in-flight/0158__app_______site-admin-user-search-paging___MED__.plan.md`:
DB (paging/fields in `app_fn.search_profiles` + `search_profiles_count` pair) deployed and
functionally verified in a rolled-back claims txn (fields, windows, count, status filter, 30000
guard); `pnpm build` 13/13 green; UI walkthrough deferred to the user's own testing.
In-flight corrections: an **unused** connection-form `searchProfiles.graphql` already existed —
overwritten with the list + count form; `allAppProfiles.graphql` deleted (no other consumer).

## Purpose

`/tenant/site-admin/user` lets a **super admin** (`p:app-admin-super` nav gate) find and view
**any user in the entire system**. Today it renders every `app.profile` unfiltered
(`AllAppProfiles`) with a documented Known Gap: no search, no pagination. This spec closes that
gap: a debounced server-side search (email, display name, full name, identifier) with
limit/offset pagination, backed by the **already-existing but never-wired**
`app_api.search_profiles(_options)` DB function
(`db/fnb-app/deploy/00000000010243_app_fn_support.sql`) plus a new count companion.

## Locked decisions

| Decision | Choice | Why |
|---|---|---|
| **Server-side search + paging** | Debounced search term → `app_api.search_profiles`; limit/offset implemented in `app_fn.search_profiles` via the existing (declared, unimplemented) `_options.paging_options`; new `search_profiles_count` companion returns the total for the pager. | User choice 2026-07-27. Scales past a modest user base; stops shipping the whole platform's users to the client. |
| **Reuse the existing fn pair** | Extend `app_fn.search_profiles` in place (fields + order + paging) rather than adding a new function. | It exists precisely for this (`search_tenants` sibling precedent); the `app_fn.search_profiles_options` composite already declares `search_term`, `status`, `paging_options`. |
| **Fields searched** | `email`, `display_name`, `full_name`, `identifier` — citext `like '%term%'` (case-insensitive). | The current body only covers email + display_name; name/identifier lookups are the obvious admin searches. |
| **Guard stays `p:app-admin-support`** | Both fn and count fn keep the existing guard. | Matches the sibling `search_tenants`/`search_residents` guards; the page's nav is already `p:app-admin-super`, and support ⊂ the intended audience for platform search. |
| **`page_offset` unused** | Paging uses `item_limit`/`item_offset` only; `paging_options.page_offset` stays dormant. | One offset vocabulary; the client computes `item_offset = (page-1) * pageSize`. |
| **Page size 25, `UPagination`** | Fixed page size, real page numbers from `searchProfilesCount`. | Count is one cheap aggregate; real paging beats load-more for an admin search screen. |
| **`AllAppProfiles` retired from this page** | The page's list source becomes `SearchProfiles`; delete the `AllAppProfiles` op if no other consumer remains. | It fetched every profile **plus** residents + licenses the list never rendered. |
| **No status filter in the UI (yet)** | `_options.status` stays available server-side; UI ships search-term-only. | Keep the first cut lean; the composite already supports it if wanted later. |

## Files in this spec

| File | Covers |
|---|---|
| `README.md` | This index |
| `index.ui.md` | User list page — search input + pagination + `UserList` table |
| `index.data.md` | User list page — `SearchProfiles` query, count, composable |
| `[id].ui.md` / `[id].data.md` | User detail page (unchanged — implemented) |
| `../_shared.data.md` | Module-wide GraphQL setup, permission model, ops table |

## Implementation Task List

### Phase 1 — DB (in-place edits, then env rebuild by the user)
- [x] `00000000010243_app_fn_support.sql` — `app_fn.search_profiles`: add `full_name` +
  `identifier` to the predicate; apply `_options.status`; `order by display_name nulls last,
  email`; apply `limit coalesce(item_limit, 25) offset coalesce(item_offset, 0)`
- [x] Same file — new `app_fn.search_profiles_count(_options) returns integer` (same predicate,
  no paging) + `app_api.search_profiles_count` (INVOKER, `p:app-admin-support` guard)
- [x] Update the change's revert/verify files
- [x] Ask the user to rebuild; verify read-only (search by partial email/name/identifier; count
  matches unpaged predicate; limit/offset windows correctly; non-support role raises 30000)

### Phase 2 — GraphQL client
- [x] New op `searchProfiles.graphql`: `SearchProfiles($searchTerm, $limit, $offset)` selecting
  `searchProfilesList(_options: …) { ...Profile }` + `searchProfilesCount(_options: { searchTerm: $searchTerm })`
  (confirm codegen names — mirror the `SearchTenants` connection form if the list form is absent)
- [x] Codegen; rewrite `useSiteAdminUsers` to the reactive search/page signature (see `index.data.md`)
- [x] Delete `allAppProfiles.graphql` if no other consumer remains

### Phase 3 — tenant-app UI
- [x] `pages/site-admin/user/index.vue`: search `UInput` (debounced 300 ms, resets to page 1),
  `UPagination` (page size 25, total from count), subtitle from count, empty state
- [x] `pnpm build` gate green

### Phase 4 — spec upkeep
- [x] README status → Implemented; boxes checked; `index.ui.md` Known Gap removed; ops table in
  `../_shared.data.md` updated

## Remaining Open Questions
- None blocking.

## Considered & rejected
- **Client-side filtering over `AllAppProfiles`** — keeps shipping every profile (with residents +
  licenses) to the browser; the DB fn already exists.
- **Search-only without paging** — the count companion is one aggregate; paging now avoids a
  second pass at the same file later.
- **GraphQL-level pagination (connection `first`/`offset` + `totalCount`)** — the plpgsql setof
  function materializes its full result before PostGraphile's limit applies; user chose paging
  implemented in `app_fn.search_profiles` itself.
- **Tightening the fn guard to `p:app-admin-super`** — would diverge from the sibling
  `search_tenants`/`search_residents` guards for no security gain (support is a trusted platform role).
