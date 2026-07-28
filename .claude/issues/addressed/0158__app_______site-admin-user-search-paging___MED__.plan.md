# Plan: site-admin/user platform search + pagination

> **Execution Directive:** plan + build this via `/fnb-stack-implementor <this-file>` — execute
> the phases below in order. Source spec: `.claude/specs/tenant-app/site-admin/user/README.md`
> (contract in `index.{ui,data}.md`; ops table in `../_shared.data.md`). Never run `git`. Never
> rebuild/restart the env — ask the user, then verify read-only.

**Severity: MED** (feature; closes the documented no-search/no-pagination Known Gap) ·
Category: app · Identified: 2026-07-27

## Summary

`/tenant/site-admin/user` gets a debounced **server-side search** (email, display name, full
name, identifier) with **limit/offset pagination** (page size 25, `UPagination` with a real
total). Backed by the **already-existing but never-wired** `app_api.search_profiles(_options)`
(`db/fnb-app/deploy/00000000010243_app_fn_support.sql:437`; `p:app-admin-support` guard, kept —
matches the sibling `search_tenants`/`search_residents`) plus a new `search_profiles_count`
companion. The page's `AllAppProfiles` op (every profile + residents + licenses, unfiltered) is
retired from this page.

---

## Phase 1 — DB (in-place edits; then USER rebuilds, we verify read-only)

1. **`deploy/00000000010243_app_fn_support.sql`** — `app_fn.search_profiles` (line 453; the
   `-- profile: add paging options` comment marks the intent):
   - predicate: add `p.full_name` + `p.identifier` to the existing email/display_name citext
     `like '%'||_options.search_term||'%'` ors; apply
     `(_options.status is null or p.status = _options.status)`
   - `order by p.display_name nulls last, p.email`
   - paging: `limit coalesce((_options.paging_options).item_limit, 25)
     offset coalesce((_options.paging_options).item_offset, 0)` — `page_offset` stays unused
     (locked decision).
2. **Same file** — new `app_fn.search_profiles_count(_options app_fn.search_profiles_options)
   returns integer` (same predicate, no order/paging) + `app_api.search_profiles_count` — INVOKER
   STABLE, same `p:app-admin-support` guard as `app_api.search_profiles` (:437). The
   `app_fn.search_profiles_options` composite (`00000000010230_app_fn_types.sql:100`) already has
   `search_term`, `status`, `paging_options` — no type change. Update `revert/` + `verify/` for
   10243 (files verified present).
3. **STOP → ask the user to rebuild.** Then read-only verification: search by partial
   email / display name / full name / identifier; count matches the unpaged predicate;
   limit/offset windows correctly (page 2 ≠ page 1, exact-multiple boundary ok); status filter
   works; claims without `p:app-admin-support` → `30000`.

## Phase 2 — GraphQL client (`packages/graphql-client-api`)

4. **New op** `src/graphql/app/query/searchProfiles.graphql`:
   ```graphql
   query SearchProfiles($searchTerm: String, $limit: Int, $offset: Int) {
     searchProfilesList(_options: {
       searchTerm: $searchTerm
       pagingOptions: { itemLimit: $limit, itemOffset: $offset }
     }) { ...Profile }
     searchProfilesCount(_options: { searchTerm: $searchTerm })
   }
   ```
   (`Profile` fragment exists — `src/graphql/app/fragment/Profile.graphql`.) **Verify the
   generated field names** after rebuild — if only the connection form exists, mirror
   `searchTenants.graphql` (`searchTenants(_options: …) { nodes … }`). Composite-input key
   inflection (`searchTerm`/`pagingOptions`/`itemLimit`/`itemOffset`) confirmed against
   `src/generated/fnb-graphql-api.ts` / GraphiQL; tags nudge only if needed.
5. **Codegen** — `pnpm -F @function-bucket/fnb-graphql-client-api generate`.
6. **Rewrite `useSiteAdminUsers`** (`src/composables/useSiteAdminUsers.ts` — currently wraps
   `useAllAppProfilesQuery` with no variables):
   `useSiteAdminUsers(opts: { searchTerm: Ref<string>, page: Ref<number>, pageSize?: number })`
   (default 25) → variables as a `computed` (`limit = pageSize`, `offset = (page-1)*pageSize`,
   empty term → `null`) so urql re-executes reactively; returns
   `{ users, totalCount, pageCount, fetching, error }`; `users` mapped through the existing
   `toProfile` mapper. `useSiteAdminUser` (detail) untouched.
7. **Retire `AllAppProfiles`**: consumers are only `useSiteAdminUsers` (verified — the
   `[id].vue`/detail path uses `SiteUserById`); delete `src/graphql/app/query/allAppProfiles.graphql`
   after the rewrite. Barrel already exports `./composables/useSiteAdminUsers` — no change.
   Build: `pnpm -F @function-bucket/fnb-graphql-client-api build`.

## Phase 3 — tenant-app UI (`apps/tenant-app`)

8. **`app/pages/site-admin/user/index.vue`** (re-export file unchanged) — per `index.ui.md`:
   - `searchInput` ref → debounced 300 ms into the composable's `searchTerm` ref; any change
     resets `page` to 1 (plain `watch` + `setTimeout`, or VueUse `watchDebounced` if already
     available in the app — do not add a new dependency for this)
   - search `UInput` (`icon="i-lucide-search"`, placeholder
     "Search by name, email, or identifier", clearable) between `PageHeader` and the table
   - subtitle `${totalCount} platform users`; `UserList.vue` unchanged; `UEmpty` when zero rows
     (UC8); `UPagination` below the table (`v-model:page`, `:total="totalCount"`,
     `:items-per-page="25"`, hidden when `pageCount <= 1`)
   - keep rows rendered (dimmed) while `fetching` — no layout jump
   - Route `/site-admin/**` already `ssr: false` (`nuxt.config.ts:33` — UC14 covered).
9. **`pnpm build`** gate green (repo-wide `pnpm lint` is known-broken).

## Phase 4 — spec upkeep

10. Flip spec statuses to Implemented (`README.md`, `index.{ui,data}.md`); remove the old Known
    Gap; confirm the ops-table row in `../_shared.data.md`. Ask the user before moving this plan
    to `addressed/`.

---

## Verification (end-to-end, read-only)

- As super admin: page loads page 1 of all users with the true total in the subtitle; typing a
  partial name/email/identifier narrows server-side (Network tab shows `SearchProfiles` POSTs
  with the debounced term, not per-keystroke); paging walks distinct windows; clearing the term
  restores the full paged list.
- `POST /graphql-api/api/graphql` only — no REST, no GET; no console ESM/barrel errors.

## Risks / notes

- **Guard is `p:app-admin-support`**, page nav is `p:app-admin-super` — intentional (locked
  decision; sibling-search parity). Not a widening: support is a trusted anchor-tenant role.
- **Count query cost** is one aggregate per (debounced) term — acceptable; it rides in the same
  GraphQL document as the list.
- **plpgsql setof materialization** means the DB-level limit is the efficiency win vs the
  rejected GraphQL-level pagination — that's why paging lives in the fn.
