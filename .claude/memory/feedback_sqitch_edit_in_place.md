---
name: sqitch-edit-in-place
description: Current phase — SQL changes edit existing sqitch deploy files in place; do not add new deploy files
metadata:
  type: feedback
---

For SQL changes, edit the existing `db/*/deploy/*.sql` files in place — do not create new sqitch
deploy files or `sqitch.plan` entries right now (stated 2026-07-06, "right now" — may change once
the project ships and real migrations are needed).

**Why:** Pre-release phase — a Docker rebuild wipes the DB and redeploys the whole sqitch plan
from scratch (see [[rebuild-wipes-db]]), so in-place edits are safe and keep the plan flat. The
user follows this pattern themselves (e.g. adding `tags`/`parent_asset_id` directly to
`00000000010600_storage.sql`).

**How to apply:** Put new functions/columns/policies in the existing file where they logically
belong. Mind deploy order within the existing plan — e.g. `n8n_worker`-only `storage_fn`
functions live in a change after the policies file's blanket `grant execute ... to authenticated`
so their revokes stick. New changes are still acceptable when a change genuinely needs a new
cross-project dependency (precedent: `00000000010640_storage_n8n_worker` depending on
`fnb-n8n`). Never run `git` during a sqitch session.
