# Recurring: RLS / permission audit sweep

> **Execution Directive:** This is a recurring playbook — run *this* plan periodically; it never
> "finishes" and is never prioritized or closed. A run may spawn new numbered `identified/` items
> for concrete findings. Implement fixes via the `sqitch-expert` + `fnb-db-designer` skills.
> Never run `git` in a sqitch session; never redeploy the DB yourself — ask the user, then verify
> read-only.

**Category: security · Recurring (no rank, no severity)**

## When to run

After any new `db/<module>` change lands, and on a periodic cadence, re-audit the whole DB tree for
RLS/permission coverage. This is the sweep that produced `0020__security__fn-schema-grant-bypass`,
`0030__wf__wf-rls-missing`, `0050__security__security-definer-search-path`, and
`0060__security__rls-gaps-msg-loc-app`.

## Scope / checklist (global-rules R8, R9, R12)

1. **Every table has RLS enabled** — grep each `db/*/deploy/*_policies.sql` for
   `enable row level security`; confirm one `alter table … enable row level security` per table
   (watch for copy-paste bugs where the wrong table name is enabled — see the msg_tenant case).
2. **Every table has at least one policy** using the `jwt.*()` helpers (`jwt.has_permission`,
   `jwt.tenant_id`), and UPDATE/DELETE policies exist where those operations are exposed.
3. **`grant ... to anon` is intentional** — flag any blanket `grant all on all routines/tables in
   schema <module>_fn to anon, authenticated` that exposes SECURITY DEFINER `_fn` logic publicly.
4. **Every `<module>_api.*` mutation calls `jwt.enforce_permission('p:…')`** before delegating to
   `_fn` (R8). Diff the `_api` surface against its `_fn` counterparts.
5. **SECURITY DEFINER functions pin `set search_path = ''`** and fully schema-qualify calls.
6. **No superuser DB connections** — app/worker `DATABASE_URL` uses the `authenticator` role, not
   `postgres`.

## Output

For each real gap found, create a numbered `identified/[####]__[category]__[title-slug]__[SEV]__.plan.md`
item (R23) with a self-referential Execution Directive.
