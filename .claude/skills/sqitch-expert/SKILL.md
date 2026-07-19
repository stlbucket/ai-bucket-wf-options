---
name: sqitch-expert
description: >
  Expert in sqitch database change management for this project. Use this skill for any sqitch task:
  adding new changes, managing dependencies, deploying/reverting/verifying, tagging releases,
  reworking existing changes, troubleshooting plan conflicts, and understanding project structure.
  Triggers include: "add a sqitch change", "deploy the database", "revert a change", "tag a release",
  "rework a change", "sqitch status", "sqitch plan", "sqitch dependency", or any question about
  managing database migrations in this project.
---

# Sqitch Expert

You are a sqitch database change management expert for this specific project. You know sqitch deeply
and understand how this project uses it. Always read the relevant `sqitch.plan` and deploy scripts
before giving advice — the plan is the source of truth.

## Project Structure

This project has nine sqitch packages under `db/`, deployed in the order set by the
`DEPLOY_PACKAGES` variable in `.env` (the single source of truth, read by both
`scripts/db-deploy.ts` and docker-compose's db-migrate service):

```
db/
  fnb-auth/     ← extensions, jwt helpers, roles — deployed first
  fnb-app/      ← anchor application schema (tenants, residents, licenses)
  fnb-msg/      ← messaging domain
  fnb-todo/     ← todo domain
  fnb-loc/      ← location domain
  fnb-wf/       ← workflow domain — must precede fnb-storage
  fnb-storage/  ← asset storage domain
  fnb-location-datasets/ ← public datasets (breweries)
  fnb-airports/ ← public airports dataset (OurAirports) — last
  my-app/       ← cruft, NOT deployed — never extend it
```

Each package is a self-contained sqitch project:
```
db/<package>/
  sqitch.conf    ← engine config (pg)
  sqitch.plan    ← ordered change registry
  deploy/        ← SQL that applies the change
  revert/        ← SQL that undoes the change
  verify/        ← SQL that confirms the change succeeded
```

### Deployment
`pnpm db-deploy` (→ `scripts/db-deploy.ts`) ensures the `anon`/`authenticated`/`service_role`
roles exist, then runs this Docker command for each package in `DEPLOY_PACKAGES`, then applies
`db/seed.sql`:
```bash
docker run --rm \
  --network fnb-network \
  -v "$REPO_ROOT/db/<package>:/repo" \
  sqitch/sqitch deploy "$DB_URL"
```
To run a single package: run that `docker run` command manually. Related scripts:
`pnpm db-status` (sqitch status), `pnpm db-psql`, `pnpm db-rebuild` (destructive — **ask the
user first**; rebuild wipes the DB and reseeds it).

### Change Naming Convention
Change names follow this numeric prefix pattern:
```
00000000010000_<slug>   ← base/init changes
00000000010100_<slug>   ← extensions / infrastructure
00000000010200_<slug>   ← schema / role creation
00000000010210_<slug>   ← schema functions
00000000010250_<slug>   ← policies / grants
```
Increment by 10 for changes at the same level; increment by 100 for a new category. Choose a number
that leaves room for future changes between existing ones. Each package also owns a distinct
hundreds-range across the whole repo (auth=101xx, app=102xx, loc=103xx, msg=104xx, todo=1045x,
wf=105xx, storage=106xx, location_datasets=107xx) — a new package takes the next free range.

### sqitch.plan Format
```
%syntax-version=1.0.0
%project=fnb-auth

changename [dep1 dep2] 2026-04-18T00:00:00Z Developer <dev@example.com> # Short description
```
- Dependencies in `[brackets]` are required when this change needs another to exist first
- Cross-package dependencies use `project:changename` syntax (e.g. `[fnb-app:00000000010220_app]`)
  — see Dependency Management below; every module package declares one on fnb-app
- Changes must appear after all their dependencies in the plan

---

## Core Commands

### Add a new change
```bash
# With sqitch CLI (if installed locally)
sqitch add <changename> --requires <dep> -n 'Description'

# Or create the three files manually and add the plan entry
```
This creates `deploy/<name>.sql`, `revert/<name>.sql`, `verify/<name>.sql` and adds a plan entry.

**When adding manually**, always create all three files and add the plan entry in the correct position.

### Deploy
```bash
# Deploy all packages (via Docker)
bash scripts/db-deploy.sh

# Deploy a specific package
docker run --rm --network fnb-network \
  -v "$PWD/db/<package>:/repo" sqitch/sqitch deploy "$DB_URL"

# Deploy to a specific change
docker run --rm --network fnb-network \
  -v "$PWD/db/<package>:/repo" sqitch/sqitch deploy --to <changename> "$DB_URL"
```

### Revert
```bash
docker run --rm --network fnb-network \
  -v "$PWD/db/<package>:/repo" sqitch/sqitch revert "$DB_URL"

# Revert to a specific change (inclusive revert to that point)
docker run --rm --network fnb-network \
  -v "$PWD/db/<package>:/repo" sqitch/sqitch revert --to <changename> "$DB_URL"
```

### Verify
```bash
docker run --rm --network fnb-network \
  -v "$PWD/db/<package>:/repo" sqitch/sqitch verify "$DB_URL"
```

### Status
```bash
docker run --rm --network fnb-network \
  -v "$PWD/db/<package>:/repo" sqitch/sqitch status "$DB_URL"
```

### Rebase (revert then redeploy)
```bash
docker run --rm --network fnb-network \
  -v "$PWD/db/<package>:/repo" sqitch/sqitch rebase -y "$DB_URL"
```

### Tag a release
```bash
docker run --rm --network fnb-network \
  -v "$PWD/db/<package>:/repo" sqitch/sqitch tag <tagname> -n 'Release note'
```
Tags appear in `sqitch.plan` and are required before reworking a change.

### Rework an existing change
```bash
docker run --rm --network fnb-network \
  -v "$PWD/db/<package>:/repo" sqitch/sqitch rework <changename> -n 'What changed'
```
- Requires a tag to exist after the original change
- Creates `deploy/<changename>@<tag>.sql` (copy of original), then a new `deploy/<changename>.sql`
- The old scripts become the revert path for the new version

---

## Writing Good Scripts

### Deploy scripts
- Wrap in a transaction when possible: `BEGIN; ... COMMIT;`
- Use `IF NOT EXISTS` / `OR REPLACE` where the engine supports it for idempotency
- Keep each change focused — one schema object per change is ideal

```sql
BEGIN;
CREATE TABLE app.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE
);
COMMIT;
```

### Revert scripts
- Exact inverse of deploy, in reverse order for multi-statement deploys
- Use `IF EXISTS` to make reverting safe

```sql
BEGIN;
DROP TABLE IF EXISTS app.users;
COMMIT;
```

### Verify scripts
- Must throw an exception (not return false) to signal failure
- Do NOT check row data — only check structural existence
- Reliable patterns:

| What to verify | Script pattern |
|---|---|
| Table exists | `SELECT 1/COUNT(*) FROM information_schema.tables WHERE table_schema='app' AND table_name='users';` |
| Column exists | `SELECT email FROM app.users WHERE false;` |
| Schema exists | `SELECT pg_catalog.has_schema_privilege('app', 'usage');` |
| Function exists | `SELECT has_function_privilege('app.my_fn(uuid)', 'execute');` |
| Index exists | `SELECT 1/COUNT(*) FROM pg_indexes WHERE indexname='users_email_idx';` |
| View exists | `SELECT 1/COUNT(*) FROM information_schema.views WHERE table_schema='app' AND table_name='my_view';` |
| Extension exists | `SELECT 1/COUNT(*) FROM pg_extension WHERE extname='pgcrypto';` |

The `1/COUNT(*)` trick divides by zero if the object is missing, causing an exception.

---

## Dependency Management

### Within a package
Use `[dep1 dep2]` in the plan entry. Always declare explicit deps even if order would imply them.

```
00000000010210_app_fn [00000000010200_auth] 2026-04-18T00:00:00Z Developer <dev@example.com> # App functions
```

### Across packages
Sqitch supports cross-project dependencies using `project:changename` syntax in the brackets:

```
00000000010220_app [fnb-auth:00000000010100_extensions] 2026-04-11T00:00:00Z ...
```

When sqitch deploys `fnb-app`, it verifies that `00000000010100_extensions` is already recorded in
the `fnb-auth` project's registry before allowing `00000000010220_app` to proceed. This enforces
the dependency at the database level, not just at the script level.

- `DEPLOY_PACKAGES` in `.env` still controls deploy order (fnb-auth runs before fnb-app)
- Cross-project deps add an explicit safety check on top of that ordering
- Use the `project:changename` form whenever one package genuinely requires objects from another

---

## Merge Conflicts in sqitch.plan

Configure Git's union merge driver to prevent plan conflicts on feature branches:

```gitattributes
# .gitattributes
db/*/sqitch.plan merge=union
```

```bash
git config --global merge.union.driver true
```

When conflicts do occur, manually resolve by ordering changes correctly (dependencies before dependents).

---

## Common Workflows

### Add a new table to an existing package
1. Choose the right package (e.g., `db/fnb-app`)
2. Pick a change name with an appropriate number (e.g., `00000000010210_locations`)
3. Create `deploy/`, `revert/`, `verify/` files
4. Add the plan entry with correct dependencies
5. Deploy and verify

### Fix a bug in a deployed change (already in production)
1. Tag the current state: `sqitch tag v1.x -n 'Before fix'`
2. Rework the change: `sqitch rework <changename>`
3. Edit the new deploy script
4. Write a new verify; the old deploy becomes the revert automatically
5. Rebase to apply: `sqitch rebase -y`

### Check what's deployed vs planned
```bash
docker run --rm --network fnb-network \
  -v "$PWD/db/<package>:/repo" sqitch/sqitch status "$DB_URL"
```

---

## Related Skills

- **new-db-package** — scaffold a brand-new sqitch package under `db/`
- **true-up-sqitch-package** — fill in missing revert/verify files for an existing package
- **fnb-db-designer** — what goes *inside* the deploy scripts (schema/RLS/permission conventions);
  this skill owns only the sqitch mechanics around them
- Full routing table: `.claude/skills/skill-map.md`

---

## Rules

- **Never run `git` commands** when working with sqitch in this project (per CLAUDE.md)
- Always read the current `sqitch.plan` before modifying it
- Never reorder existing plan entries — only insert new ones in the correct position
- Use `Developer <dev@example.com>` as the author in plan entries (matches existing entries)
- Use `pg` engine — all packages in this project target PostgreSQL
- DB_URL for local dev: `db:pg://postgres:1234@function_bucket:5432/fnb`
