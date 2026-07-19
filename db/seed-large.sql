---------------------- LARGE FIXTURE: 4 TENANTS / WORKSPACE TREES / TODOS ------------------------
-- Run AFTER seed.sql (needs the anchor tenant, applications, and auto-subscribe license packs).
--
-- Builds:
--   * 4 customer tenants (Large Tenant 01..04, identifiers large-tenant-01..04)
--   * a workspace tree under each: 2-4 levels deep, 0-3 branches per node (a guaranteed
--     "spine" chain keeps the tree at full depth; padded to a minimum of 5 workspaces)
--   * the tenant admin (large-tenant-NN-admin@) creates EVERY workspace
--     → admin residency in the root and every workspace of their tenant
--   * 4-7 root-level users per tenant (large-tenant-NN-user-MM@), root residency only
--   * per tenant, ONE floater user (large-tenant-NN-floater@) invited into 5 random
--     workspaces and NOT into the root — a nested-only user with ghost ancestors
--   * per tenant, 2 random workspaces get a guest who is a ROOT USER OF ANOTHER tenant
--     (user-01 of the next tenant, cyclically) — cross-tenant workspace guests
--   * every workspace gets one todo whose name spells out its lineage
--     (Large Tenant 01->WS 1-1->WS 2-3), created by the admin's residency in that workspace
--   * one home residency activated per seeded user (app_fn.assume_residency)
--
-- Profiles are inserted directly (the seed.sql pattern) — there are NO matching ZITADEL users,
-- so these accounts cannot log in unless you add them to ZITADEL (superset for zitadel-seed:
-- per tenant NN=01..04: -admin@, -floater@, -user-01@..-user-07@); they exist to exercise the
-- admin UIs, residency tree, workspace switcher, and todo tool with realistic volume.
-- setseed() makes the "random" shapes reproducible run-to-run.

begin;

do $$
declare
  t int;
  l int;
  u int;
  d int;         -- workspace depth for this tenant (2..4)
  n_users int;   -- root users for this tenant (4..7)
  n_children int;
  seq int;       -- per-tenant workspace counter (unique names without sibling collisions)
  total int;
  nn text;
  admin_email citext;
  floater_email citext;
  guest_email citext;
  root_id uuid;
  root_name text;
  pad_parent_id uuid;
  pad_level int;
  pad_lineage text;
  tenant app.tenant;
  ws app.tenant;
  parent record;
  wsrec record;
  r record;
begin
  perform setseed(0.42);

  create temp table seed_ws (
    tenant_idx int
    ,ws_id uuid
    ,parent_id uuid
    ,level int
    ,is_spine boolean
    ,lineage text
  ) on commit drop;

  for t in 1..4 loop
    nn := lpad(t::text, 2, '0');
    admin_email := format('large-tenant-%s-admin@example.com', nn);
    floater_email := format('large-tenant-%s-floater@example.com', nn);
    d := 2 + floor(random() * 3)::int;       -- 2..4
    n_users := 4 + floor(random() * 4)::int; -- 4..7

    -- profiles first, so app_fn.invite_user links profile_id as it creates each resident
    insert into app.profile (email, display_name, phone)
    select e::citext, split_part(e, '@', 1)::citext, '555.555.5555'::citext
    from (
      select admin_email::text as e
      union all
      select floater_email::text
      union all
      select format('large-tenant-%s-user-%s@example.com', nn, lpad(s::text, 2, '0'))
      from generate_series(1, n_users) s
    ) emails;

    tenant := app_fn.create_tenant(
      _name => format('Large Tenant %s', nn)::citext
      ,_identifier => format('large-tenant-%s', nn)::citext
      ,_email => admin_email
      ,_type => 'customer'::app.tenant_type
    );
    root_id := tenant.id;
    root_name := tenant.name;

    -- workspace tree: the spine node at each level always continues (1-3 children) so the
    -- tree reaches depth d; every other node branches 0-3. The tenant admin creates every
    -- workspace, so they hold the admin residency throughout.
    seq := 0;
    n_children := 1 + floor(random() * 3)::int; -- level 1 (under the root): 1..3
    for c in 1..n_children loop
      seq := seq + 1;
      ws := app_fn.create_workspace(root_id, format('WS 1-%s', seq)::citext, admin_email);
      insert into seed_ws values (t, ws.id, root_id, 1, c = 1, format('%s->WS 1-%s', root_name, seq));
    end loop;

    for l in 2..d loop
      for parent in select * from seed_ws where tenant_idx = t and level = l - 1 loop
        if parent.is_spine then
          n_children := 1 + floor(random() * 3)::int; -- 1..3: the spine continues
        else
          n_children := floor(random() * 4)::int;     -- 0..3
        end if;
        for c in 1..n_children loop
          seq := seq + 1;
          ws := app_fn.create_workspace(parent.ws_id, format('WS %s-%s', l, seq)::citext, admin_email);
          insert into seed_ws values (
            t, ws.id, parent.ws_id, l, parent.is_spine and c = 1,
            format('%s->WS %s-%s', parent.lineage, l, seq)
          );
        end loop;
      end loop;
    end loop;

    -- pad to a minimum of 5 workspaces (the floater needs 5), attaching each extra child to
    -- the least-branched parent above max depth so no node ever exceeds 3 branches
    loop
      select count(*) into total from seed_ws where tenant_idx = t;
      exit when total >= 5;
      select cand.id, cand.lvl, cand.lineage
      into strict pad_parent_id, pad_level, pad_lineage
      from (
        select root_id as id, 0 as lvl, root_name as lineage
        union all
        select ws_id, level, lineage from seed_ws where tenant_idx = t and level < d
      ) cand
      left join seed_ws ch on ch.tenant_idx = t and ch.parent_id = cand.id
      group by cand.id, cand.lvl, cand.lineage
      having count(ch.ws_id) < 3
      order by count(ch.ws_id), cand.lvl
      limit 1;

      seq := seq + 1;
      ws := app_fn.create_workspace(pad_parent_id, format('WS %s-%s', pad_level + 1, seq)::citext, admin_email);
      insert into seed_ws values (
        t, ws.id, pad_parent_id, pad_level + 1, false,
        format('%s->WS %s-%s', pad_lineage, pad_level + 1, seq)
      );
    end loop;

    -- root-level users (root residency only; cross-tenant workspace guesting is pass 2)
    for u in 1..n_users loop
      perform app_fn.invite_user(
        root_id
        ,format('large-tenant-%s-user-%s@example.com', nn, lpad(u::text, 2, '0'))::citext
        ,'user'
      );
    end loop;

    -- the floater: 5 random workspaces, never the root — their home residency IS a workspace
    for wsrec in select ws_id from seed_ws where tenant_idx = t order by random() limit 5 loop
      perform app_fn.invite_user(wsrec.ws_id, floater_email, 'user');
    end loop;

    -- one todo per workspace, named for its lineage, created by the admin's residency there
    for wsrec in select ws_id, lineage from seed_ws where tenant_idx = t loop
      perform todo_fn.create_todo(
        wsrec.lineage::citext
        ,row(null::citext, null::uuid, null::citext[], false)::todo_fn.create_todo_options
        ,(select id from app.resident where tenant_id = wsrec.ws_id and email = admin_email)
      );
    end loop;

    raise notice 'large-tenant-%: depth %, % workspaces, % root users',
      nn, d, (select count(*) from seed_ws where tenant_idx = t), n_users;
  end loop;

  -- pass 2: per tenant, 2 random workspaces get a guest who is a root user of the NEXT
  -- tenant (cyclic) — every user-01 ends up guesting in someone else's workspaces
  for t in 1..4 loop
    guest_email := format(
      'large-tenant-%s-user-01@example.com', lpad(((t % 4) + 1)::text, 2, '0')
    )::citext;
    for wsrec in select ws_id from seed_ws where tenant_idx = t order by random() limit 2 loop
      perform app_fn.invite_user(wsrec.ws_id, guest_email, 'user');
    end loop;
  end loop;

  -- activate each seeded user's home residency (the seed.sql activation pass, but through
  -- app_fn.assume_residency so license.profile_id is updated the same way a real switch does)
  for r in
    select res.id, res.email
    from app.resident res
    where res.email like 'large-tenant-%@example.com'
      and res.type = 'home'
      and not exists (
        select 1 from app.resident a where a.email = res.email and a.status = 'active'
      )
  loop
    perform app_fn.assume_residency(r.id, r.email::citext);
  end loop;
end;
$$;

commit;

-- Optional: drop the super admin into the DEEPEST workspace of large-tenant-01 so bucket@'s
-- own workspace switcher renders that chain with every ancestor as a ghost row (uncomment).
-- begin;
--   with recursive chain as (
--     select id, 0 as lvl from app.tenant where identifier = 'large-tenant-01'
--     union all
--     select c.id, chain.lvl + 1 from app.tenant c join chain on c.parent_tenant_id = chain.id
--   )
--   select app_fn.invite_user(
--     (select id from chain order by lvl desc limit 1)
--     ,'bucket@function-bucket.net'
--     ,'admin'
--   );
-- commit;
