-- app_fn.invite_user creates the app.profile EAGERLY (at invite time, idp_user_id null) so a
-- not-yet-logged-in invitee is a first-class person: visible in app_fn.workspace_resident_pool and
-- de-dupable in the subtree roll-up (which groups on profile_id). Regression cover for the
-- parent→child "Manage Residents" bug + the "multiple user records in the parent" duplicate.
-- Spec: docs/specs/user-invitation/_shared.data.md. Run as owner (SECURITY DEFINER pre-claims fns).
\set parent '40000000-0000-0000-0000-000000000001'
\set child  '40000000-0000-0000-0000-000000000002'

begin;
set search_path to tap, public;
select plan(15);

-- a root customer tenant + a child workspace under it (chk_nested_parent: workspace carries a parent)
insert into app.tenant (id, name, type, status)
  values (:'parent'::uuid, 'eager-parent', 'customer', 'active');
insert into app.tenant (id, name, type, status, parent_tenant_id)
  values (:'child'::uuid, 'eager-child', 'workspace', 'active', :'parent'::uuid);

-- invite alice into the PARENT (she never logs in)
select (app_fn.invite_user(:'parent'::uuid, 'alice@test.local'::citext)).id as parent_res \gset

-- (1) the invite creates a profile for the email
select is((select count(*) from app.profile where email = 'alice@test.local')::int, 1,
  'invite creates an app.profile for the email');
-- (2) the eager profile has no idp_user_id until first OIDC login
select is((select idp_user_id from app.profile where email = 'alice@test.local'), null,
  'eager profile has no idp_user_id until first login');
-- (3) the parent resident is linked to that profile immediately
select isnt((select profile_id from app.resident where id = :'parent_res'::uuid), null,
  'the parent resident is linked to the profile');
-- (4) the first residency for an email is a home residency
select is((select type::text from app.resident where id = :'parent_res'::uuid), 'home',
  'the first residency for the email is home');
-- (5) she is visible in the CHILD workspace pool (spine includes the parent lineage)
select is((select count(*) from app_fn.workspace_resident_pool(:'child'::uuid)
             where email = 'alice@test.local')::int, 1,
  'not-yet-logged-in parent invitee appears in the child workspace pool');
-- (6) ...and is not yet a member of the child
select is((select is_member from app_fn.workspace_resident_pool(:'child'::uuid)
             where email = 'alice@test.local'), false,
  'parent invitee is not yet a member of the child workspace');

-- add alice to the CHILD (what "Manage Residents" ultimately does — reuses invite_user)
select (app_fn.invite_user(:'child'::uuid, 'alice@test.local'::citext)).id as child_res \gset

-- (7) the second invite reuses the one profile (no duplicate person)
select is((select count(*) from app.profile where email = 'alice@test.local')::int, 1,
  'a second invite in a child reuses the one profile (no duplicate)');
-- (8) both residencies point at the same person
select is(
  (select profile_id from app.resident where id = :'child_res'::uuid),
  (select profile_id from app.resident where id = :'parent_res'::uuid),
  'the child residency links to the same profile as the parent');
-- (9) the pool now reports membership of the child
select is((select is_member from app_fn.workspace_resident_pool(:'child'::uuid)
             where email = 'alice@test.local'), true,
  'after the second invite alice is a member of the child workspace');
-- (10) the subtree roll-up groups both residencies under the one profile
select is((select count(distinct profile_id) from app_fn.tenant_subtree_residents(:'parent'::uuid)
             where email = 'alice@test.local')::int, 1,
  'both residencies share one profile in the subtree roll-up');
-- (11) ...while still listing both residencies (the client collapses them to one row)
select is((select count(*) from app_fn.tenant_subtree_residents(:'parent'::uuid)
             where email = 'alice@test.local')::int, 2,
  'the roll-up lists both residencies (parent + child) for the one person');

-- (12) first OIDC login ADOPTS the eager profile (email match) rather than minting a second
select (app_fn.provision_idp_user('zid-alice-1', 'alice@test.local'::citext)).id as adopted \gset
select is(
  (select count(*) from app.profile where email = 'alice@test.local'
     and id = :'adopted'::uuid and idp_user_id = 'zid-alice-1')::int, 1,
  'provision_idp_user adopts the eager profile by email (sets idp_user_id, no duplicate)');

-- (13) app.profile.display_name is UNIQUE — a colliding email local part must not break the invite
select (app_fn.invite_user(:'parent'::uuid, 'alice@elsewhere.local'::citext)).id as collide_res \gset
select is((select display_name from app.profile where email = 'alice@elsewhere.local'), null,
  'a colliding display_name (shared local part) falls back to null instead of erroring');

-- (14)/(15) the brand-new login fallback (never-invited ZITADEL identity) is also collision-safe:
-- two un-invited users sharing a local part must both provision without a unique-violation login break
select (app_fn.provision_idp_user('zid-sam-a', 'sam@a.local'::citext)).display_name as sam_a \gset
select is(:'sam_a'::citext, 'sam'::citext,
  'first brand-new login takes the email local part as display_name');
select (app_fn.provision_idp_user('zid-sam-b', 'sam@b.local'::citext)).id as sam_b \gset
select is((select display_name from app.profile where id = :'sam_b'::uuid), null,
  'second brand-new login with a colliding local part falls back to null (no login break)');

select * from finish();
rollback;
