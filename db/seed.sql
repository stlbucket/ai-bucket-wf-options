---------------------- DEV SEED: ANCHOR TENANT + LARGE FIXTURE ------------------------------------
-- The full local-dev seed (env-build / SEED_DATA=full). env-build-empty (SEED_DATA=empty) skips
-- this file entirely — a virgin env bootstraps via /auth/setup (first-run-setup spec).
--
-- Part 1 — anchor bootstrap:
--   * anchor tenant with site admin site-admin@example.com (the app-admin-super license)
--   * anchor residents anchor-admin@example.com (admin) + anchor-user@example.com (user)
--   * base app settings (support email / display name)
-- Part 2 — large fixture: 2 customer tenants with nested node trees, todos, floaters, guests.
--
-- ZITADEL credentials are seeded separately (docker/zitadel/seed.mjs — same emails, dev
-- password 'poiuytre'); app.profile.idp_user_id links lazily on first OIDC login.

---------------------- PART 1: ANCHOR TENANT AND SITE ADMIN ---------------------------------------

-- Creates the anchor tenant (the root/platform tenant); its email becomes the site admin.
begin;
  select app_fn.create_anchor_tenant(
    _name => 'Anchor Tenant'::citext
    ,_email => 'site-admin@example.com'::citext
  );
commit;

-- Inserts base app settings (support email and display name)
begin;
  insert into app.app_settings(application_key, key, display_name, value) values ('base', 'support-email', 'Site Support Email', 'site-support@example.com');
  insert into app.app_settings(application_key, key, display_name, value) values ('base', 'support-display-name', 'Site Support Display Name', 'Site Support');
commit;

-- Creates the seed profiles DIRECTLY in app.profile. There is no auth.user anymore —
-- ZITADEL owns credentials (the zitadel-seed compose job creates the matching ZITADEL
-- users with the dev password). app.profile.idp_user_id stays null here and links lazily
-- on each user's first OIDC login (app_fn.provision_idp_user email match).
begin;
  with usrs(email, display_name, first_name, last_name, phone) as (
    values
    ('site-admin@example.com', 'site-admin', null, null, '555.555.5555')
    ,('anchor-admin@example.com', 'anchor-admin', null, null, '555.555.5555')
    ,('anchor-user@example.com', 'anchor-user', null, null, '555.555.5555')
  )
  insert into app.profile (email, display_name, first_name, last_name, phone)
  select email::citext, display_name::citext, first_name::citext, last_name::citext, phone::citext
  from usrs;

  -- what the retired app_fn.handle_new_user trigger used to do: link pending residents
  update app.resident r set
    profile_id = p.id
  from app.profile p
  where r.email = p.email
  and r.status != 'blocked_individual'
  and r.status != 'blocked_tenant'
  ;
commit;

-- Invites the anchor admin + anchor user into the anchor tenant (profiles already exist, so
-- invite_user links profile_id as it creates each resident).
begin;
  select app_fn.invite_user(t.id, e.email::citext, e.scope::app.license_type_assignment_scope)
  from app.tenant t
  cross join (
    values
    ('anchor-admin@example.com', 'admin')
    ,('anchor-user@example.com', 'user')
  ) e(email, scope)
  where t.type = 'anchor';
commit;

-- Activates home residency for the three anchor-tenant users
begin;
  select app_fn.assume_residency(r.id, r.email::citext)
  from app.resident r
  where r.email in ('site-admin@example.com', 'anchor-admin@example.com', 'anchor-user@example.com')
  and r.type = 'home';
commit;

---------------------- PART 2: LARGE FIXTURE — 2 TENANTS / NESTED NODE TREES / TODOS --------------
-- Needs Part 1 (anchor tenant, applications, and auto-subscribe license packs).
--
-- Builds:
--   * 2 customer tenants (Large Tenant 01..02, identifiers large-tenant-01..02)
--   * a nested-node tree under each: exactly 5 levels deep, 0-3 branches per node (a guaranteed
--     "spine" chain keeps the tree at full depth 5; padded to a minimum of 5 nodes)
--   * every nested node is randomly typed one of the interchangeable nestable types —
--     `workspace`, `client`, or `organization` (named WS/CLI/ORG N-M by its type) — so all
--     three types appear throughout every level. Created as a workspace, then relabeled (the
--     types are behaviorally identical; the workspace license pack applies to all three).
--   * the tenant admin (large-tenant-NN-admin@) creates EVERY node
--     → admin residency in the root and every nested node of their tenant
--   * 4-7 root-level users per tenant (large-tenant-NN-user-MM@), home residency in the root;
--     1-4 of them (randomly picked per node) are also invited into EVERY nested node as guests
--   * per tenant, ONE floater user (large-tenant-NN-floater@) invited into 5 random
--     nodes and NOT into the root — a nested-only user with ghost ancestors
--   * per tenant, 2 random nodes get a guest who is a ROOT USER OF THE OTHER tenant
--     (user-01 of the next tenant, cyclically) — cross-tenant node guests
--   * every node gets one todo whose name spells out its lineage
--     (Large Tenant 01->ORG 1-1->CLI 2-3), created by the admin's residency in that node
--   * one home residency activated per seeded user (app_fn.assume_residency)
--
-- Profiles are inserted directly (the Part 1 pattern) — the matching ZITADEL users come from
-- zitadel-seed (superset roster: per tenant NN=01..02: -admin@, -floater@, -user-01@..-user-07@);
-- they exist to exercise the admin UIs, residency tree, node switcher, and todo tool with
-- realistic volume. setseed() makes the "random" shapes (tree branching + node types)
-- reproducible run-to-run.

begin;

-- Create one nested node under _parent, randomly typed workspace/client/organization and named
-- WS/CLI/ORG l-seq to match. create_workspace does the residency + license pack + URN registration
-- (it always inserts type='workspace'); we then relabel — the three nestable types are behaviorally
-- interchangeable (see .claude/specs/tenant-app/admin/nestable-tenant-types/).
create function pg_temp.mk_nested(_parent uuid, _l int, _seq int, _email citext)
  returns app.tenant
  language plpgsql
  as $mk$
  declare
    _idx  int  := 1 + floor(random() * 3)::int;
    _type text := (array['workspace','client','organization'])[_idx];
    _abbr text := (array['WS','CLI','ORG'])[_idx];
    _t    app.tenant;
  begin
    _t := app_fn.create_workspace(_parent, format('%s %s-%s', _abbr, _l, _seq)::citext, _email);
    update app.tenant set type = _type::app.tenant_type where id = _t.id returning * into _t;
    return _t;
  end;
  $mk$;

do $$
declare
  t int;
  l int;
  u int;
  d int;         -- workspace depth for this tenant (2..4)
  n_users int;   -- root users for this tenant (4..7)
  n_pick int;    -- root users invited into a given nested node (1..4)
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

  for t in 1..2 loop
    nn := lpad(t::text, 2, '0');
    admin_email := format('large-tenant-%s-admin@example.com', nn);
    floater_email := format('large-tenant-%s-floater@example.com', nn);
    d := 5;                                   -- exactly 5 levels of nested nodes under the root
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

    -- nested-node tree: the spine node at each level always continues (1-3 children) so the
    -- tree reaches depth d; every other node branches 0-3. The tenant admin creates every
    -- node (each randomly typed workspace/client/organization), so they hold the admin
    -- residency throughout.
    seq := 0;
    n_children := 1 + floor(random() * 3)::int; -- level 1 (under the root): 1..3
    for c in 1..n_children loop
      seq := seq + 1;
      ws := pg_temp.mk_nested(root_id, 1, seq, admin_email);
      insert into seed_ws values (t, ws.id, root_id, 1, c = 1, format('%s->%s', root_name, ws.name));
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
          ws := pg_temp.mk_nested(parent.ws_id, l, seq, admin_email);
          insert into seed_ws values (
            t, ws.id, parent.ws_id, l, parent.is_spine and c = 1,
            format('%s->%s', parent.lineage, ws.name)
          );
        end loop;
      end loop;
    end loop;

    -- pad to a minimum of 5 nodes (the floater needs 5), attaching each extra child to the
    -- least-branched parent above max depth so no node ever exceeds 3 branches. With depth 5 the
    -- spine alone guarantees >= 5 nodes, so this is a safety net that normally never runs.
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
      ws := pg_temp.mk_nested(pad_parent_id, pad_level + 1, seq, admin_email);
      insert into seed_ws values (
        t, ws.id, pad_parent_id, pad_level + 1, false,
        format('%s->%s', pad_lineage, ws.name)
      );
    end loop;

    -- root-level users (root residency only; cross-tenant node guesting is pass 2)
    for u in 1..n_users loop
      perform app_fn.invite_user(
        root_id
        ,format('large-tenant-%s-user-%s@example.com', nn, lpad(u::text, 2, '0'))::citext
        ,'user'
      );
    end loop;

    -- 1-4 randomly-picked root users also join EVERY nested node — guest residencies
    -- (invite_user sees their existing root residency and types these 'guest'; home stays root)
    for wsrec in select ws_id from seed_ws where tenant_idx = t loop
      n_pick := 1 + floor(random() * 4)::int; -- 1..4
      for u in
        select s from generate_series(1, n_users) s order by random() limit n_pick
      loop
        perform app_fn.invite_user(
          wsrec.ws_id
          ,format('large-tenant-%s-user-%s@example.com', nn, lpad(u::text, 2, '0'))::citext
          ,'user'
        );
      end loop;
    end loop;

    -- the floater: 5 random nodes, never the root — their home residency IS a nested node
    for wsrec in select ws_id from seed_ws where tenant_idx = t order by random() limit 5 loop
      perform app_fn.invite_user(wsrec.ws_id, floater_email, 'user');
    end loop;

    -- one todo per node, named for its lineage, created by the admin's residency there
    for wsrec in select ws_id, lineage from seed_ws where tenant_idx = t loop
      perform todo_fn.create_todo(
        wsrec.lineage::citext
        ,row(null::citext, null::uuid, null::citext[], false)::todo_fn.create_todo_options
        ,(select id from app.resident where tenant_id = wsrec.ws_id and email = admin_email)
      );
    end loop;

    raise notice 'large-tenant-%: depth %, % nested nodes, % root users',
      nn, d, (select count(*) from seed_ws where tenant_idx = t), n_users;
  end loop;

  -- pass 2: per tenant, 2 random nodes get a guest who is a root user of the OTHER
  -- tenant (cyclic) — every user-01 ends up guesting in the other tenant's nodes
  for t in 1..2 loop
    guest_email := format(
      'large-tenant-%s-user-01@example.com', lpad(((t % 2) + 1)::text, 2, '0')
    )::citext;
    for wsrec in select ws_id from seed_ws where tenant_idx = t order by random() limit 2 loop
      perform app_fn.invite_user(wsrec.ws_id, guest_email, 'user');
    end loop;
  end loop;

  -- activate each seeded user's home residency (the Part 1 activation pass, but through
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

-- Optional: drop the site admin into the DEEPEST workspace of large-tenant-01 so site-admin@'s
-- own workspace switcher renders that chain with every ancestor as a ghost row (uncomment).
-- begin;
--   with recursive chain as (
--     select id, 0 as lvl from app.tenant where identifier = 'large-tenant-01'
--     union all
--     select c.id, chain.lvl + 1 from app.tenant c join chain on c.parent_tenant_id = chain.id
--   )
--   select app_fn.invite_user(
--     (select id from chain order by lvl desc limit 1)
--     ,'site-admin@example.com'
--     ,'admin'
--   );
-- commit;
