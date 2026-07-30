# Plan: `res.module_permission` `app`/`game` rows hide registry lookups from tenant admins

> **Execution Directive:** Implement this plan via `/fnb-stack-implementor <this-file>`.
> Two one-value seed edits (`db/fnb-res`, `db/fnb-game`) + a live hot-patch UPDATE + a spec
> true-up (`.claude/specs/urn-registry/_shared.data.md` §4.2). No new sqitch changes — the
> seed inserts are in-place edits reached only by a full rebuild (USER REBUILD GATE — never
> rebuild/restart the env yourself; the hot-patch makes the running env correct immediately).
> Never run `git`.

**Severity: MED** (all tenant admins lose every registry-resolved resident display name,
stack-wide) · Category: db · Planned: 2026-07-29

## Symptom (reported)

On poll `019fb11d-0bdc-7fdb-8e4c-85e7458a251a` (results_visibility = `attributed`),
`large-tenant-01-admin` cannot see attributions while `large-tenant-01-floater` can.
Expected: every admin and user in the tenant sees attributed answers.

## Root cause (verified 2026-07-29 against the live DB, RLS simulated per-user)

1. Attribution **rows** are fine for both users — `poll.response`/`poll.answer` RLS passes
   (admin holds `p:poll-admin`; poll is `attributed`). The admin's attributed table renders,
   but every **Member name is null** (`—`), which reads as "no attributions". The poll page's
   "by <creator>" badge is likewise missing for admins.
2. Names resolve through the URN registry: `resourceByRespondentResidentUrn → resident →
   displayName`. The `res.resource` SELECT policy reads the `res.module_permission` map; the
   seeded row is **`('app', 'p:app-user')`** (`db/fnb-res/deploy/00000000011000_res.sql:49`).
3. **Admin license types don't carry `p:app-user`** — `app-admin` / `app-admin-super` /
   `app-admin-support` in `install_anchor_application`
   (`db/fnb-app/deploy/00000000010240_app_fn.sql:227-249`) hold admin keys only. This is a
   deliberate design the codebase already accommodates everywhere else by OR-ing the pair
   (e.g. `enforce_any_permission('{p:app-user,p:app-admin}')`; the storage policy comment
   "tenant admins hold app-admin only (no p:app-user)"; the registry's own `('storage', null)`
   row for exactly this reason).
4. So every admin fails the registry policy for `app`-module resources (residents, tenants):
   all `resourceBy…Urn` joins return null for them — polls, todo attributions, msg names —
   while plain users (`p:app-user`) resolve fine. The floater sees names; the admin doesn't.
5. Verified fix (transaction rolled back): with `('app', NULL)` the admin resolves both
   respondents' display names. `NULL` ⇒ tenant-membership check (`jwt.tenant_id() =
   tenant_id`) — exactly "ALL admins and users in the tenant", and exactly the population the
   spec's own §4.2 rationale names (`app.resident`'s `view_all_for_tenant` is plain tenant
   membership, no permission key). `res.module_permission` PK is `module`, so an
   OR-of-two-keys row is inexpressible — NULL is the correct dialect.
6. **Same latent bug on `('game', 'p:app-user')`** (`db/fnb-game/deploy/00000000011300_game.sql:142`):
   `game.game`/`game_player`/`game_event` policies deliberately include admins
   (`p:app-user OR p:app-admin`, `00000000011330_game_policies.sql:44-58`), but the registry
   row locks admins out of game registry rows. Fix in the same pass.

Not touched: `msg`/`todo`/`poll` rows are fine (both user and admin license types carry those
keys); granting admins `p:app-user` instead would cut against the codebase-wide
"admin ≠ user key, OR the pair" design and is rejected.

## Phases

### Phase 1 — durable seed edits (in-place; reached only by full rebuild)
1. `db/fnb-res/deploy/00000000011000_res.sql:49` — change
   `('app', 'p:app-user')` → `('app', null)`; update the trailing comment to note tenant
   membership (admins hold app-admin only, mirrors `app.resident.view_all_for_tenant`).
2. `db/fnb-game/deploy/00000000011300_game.sql:142` — change
   `('game', 'p:app-user')` → `('game', null)` (game policies admit `p:app-user OR
   p:app-admin`; registry row must not be narrower).

### Phase 2 — live hot-patch (running env, no rebuild)
```sql
update res.module_permission set permission_key = null where module in ('app', 'game');
```
Takes effect on the next request — the policy reads the map at query time; claims are
unchanged. (Sqitch never sees seed edits; this keeps the live DB in step with Phase 1.)

### Phase 3 — verify (read-only)
1. Re-run the RLS simulation as `large-tenant-01-admin` (claims via `set_config`, role
   `authenticated`): the `poll.response → res.resource → app.resident` join returns both
   display names.
2. User verifies in the browser at
   `http://localhost:4000/tenant/tools/poll/019fb11d-0bdc-7fdb-8e4c-85e7458a251a` as
   large-tenant-01-admin: attributed rows show member names; "by <creator>" badge renders.

### Phase 4 — spec true-up
`.claude/specs/urn-registry/_shared.data.md` §4.2: update the seed listing —
`('app', NULL)`, `('game', NULL)` (add the row; the listing predates fnb-game), and fix the
pre-existing drift `('storage', 'p:app-user')` → `('storage', NULL)` (deploy + live DB have
been NULL all along). Keep the rationale line; it already argues for membership.

### Skipped (recorded)
- pgTAP: `db/fnb-res/test/010-rls.sql` never registers an `app`-module resource; the
  NULL-key membership path is already covered by its `loc` case (4). No test edits needed.
- No GraphQL/codegen/UI changes — the client stack is correct; this is purely the registry map.
