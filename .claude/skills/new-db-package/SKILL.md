---
name: new-db-package
description: >
  Use this skill when the user wants to create a new empty sqitch database package under the db/
  directory. Triggers include: "new db package", "create a db package", "scaffold a sqitch package",
  or when the user invokes /new-db-package with or without a package name as an argument.
---

# New DB Package

Create a new sqitch database package under the `db/` directory with one stub migration, and
register it for deployment.

**Step 1 — Get the package name**
If a name was provided as a command-line argument (ARGUMENTS), use it directly.
Otherwise, ask the user: "What should the package be named?" and wait for their reply before
proceeding. Package names follow the `fnb-<module>` convention (e.g. `fnb-loc`).

**Step 2 — Derive the migration slug and number**
Convert the package name to snake_case, removing `fnb-` from the start if it is there
(e.g. `fnb-loc` → `loc`, `myPackage` → `my_package`).

Each package owns a distinct hundreds-range in the shared numbering scheme. Check the first
plan entry of every existing `db/*/sqitch.plan` and pick the **next free `00000000010N00`
range** (currently: auth=101xx, app=102xx, loc=103xx, msg=104xx, todo=1045x, wf=105xx,
storage=106xx, location_datasets=107xx, airports=108xx; 109xx is partially used by fnb-auth's
`00000000010900_webhook` — so the next package starts at `00000000011000`). The migration filename is
`<number>_<slug>`.

**Step 3 — Create the package files**

`db/<name>/sqitch.conf` (tab-indented, matching the existing packages):
```
[core]
	engine = pg
	plan_file = sqitch.plan
	top_dir = .
```

`db/<name>/sqitch.plan`:
```
%syntax-version=1.0.0
%project=<name>

<number>_<slug> [fnb-app:00000000010220_app] <current-date>T00:00:00Z Developer <dev@example.com> # Create <slug> schema, types, and tables
```

Where `<current-date>` is today's date in `YYYY-MM-DD` format. The cross-project dependency
`[fnb-app:00000000010220_app]` matches what every module package declares (they all reference
`app.tenant` / `app.resident`); drop it only if the package genuinely doesn't touch the anchor
schema.

`db/<name>/deploy/<number>_<slug>.sql`:
```sql
begin;

create schema if not exists <slug>;
create schema if not exists <slug>_fn;

-- TODO: tables, enums, types (see fnb-db-designer skill for conventions)

commit;
```

`db/<name>/revert/<number>_<slug>.sql`:
```sql
begin;

drop schema if exists <slug>_fn cascade;
drop schema if exists <slug> cascade;

commit;
```

`db/<name>/verify/<number>_<slug>.sql`:
```sql
select pg_catalog.has_schema_privilege('<slug>', 'usage');
```

**Step 4 — Register the package for deployment**
Deployment order comes from the `DEPLOY_PACKAGES` variable — the single source of truth read by
both `scripts/db-deploy.ts` and docker-compose's db-migrate service. Append the package name in
**both** files:

- `.env`: `DEPLOY_PACKAGES=fnb-auth fnb-app ... <name>`
- `.env.example`: same line

Order matters: the new package must come after every package it depends on (`fnb-app` at
minimum; note `fnb-agent` must precede `fnb-storage`/`fnb-location-datasets`/`fnb-airports`,
and `fnb-res` precedes every URN-registering module). `.env` is the only registration point
(the old `db/db-config.ts` has been removed).

**Step 5 — Confirm**
Tell the user what was created: the full path, the migration slug/number used, and that
`DEPLOY_PACKAGES` was updated in `.env` and `.env.example`. Point out that deploying
(`pnpm db-deploy`) is their call — never rebuild or restart the environment yourself.

**Next steps (hand off, don't do here):** filling in the schema → skill `fnb-db-designer`;
plan mechanics beyond the stub → skill `sqitch-expert`; the layers above the DB → skill
`fnb-stack-implementor`.
