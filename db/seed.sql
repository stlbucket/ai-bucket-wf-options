---------------------- CREATE ANCHOR TENANT AND SUPER ADMIN USER ---------------------------------------------
-- change parameters as appropriate

-- Creates the anchor tenant (the root/platform tenant)
begin;
  select app_fn.create_anchor_tenant(
    _name => 'Anchor Tenant'::citext
    ,_email => 'bucket@function-bucket.net'::citext
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
    ('bucket@function-bucket.net', 'bucket', null, null, '555.555.5555')
    ,('tacos-AAA@example.com', 'tacos-AAA', 'Tacos', 'AAA', '555.555.5555')
    ,('tacos-BBB@example.com', 'tacos-BBB', 'Tacos', 'BBB', '555.555.5555')
    ,('burritos-AAA@example.com', 'burritos-AAA', 'Burritos', 'AAA', '555.555.5555')
    ,('burritos-BBB@example.com', 'burritos-BBB', 'Burritos', 'BBB', '555.555.5555')
    ,('my-app-tenant-admin@example.com', 'my-app-tenant-admin', null, null, '555.555.5555')
    ,('my-app-tenant-user@example.com', 'my-app-tenant-user', null, null, '555.555.5555')
    ,('your-app-tenant-admin@example.com', 'your-app-tenant-admin', null, null, '555.555.5555')
    ,('your-app-tenant-user@example.com', 'your-app-tenant-user', null, null, '555.555.5555')
    ,('our-app-tenant-user@example.com', 'our-app-tenant-user', null, null, '555.555.5555')
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

-- Activates residency for the super admin so they can act as a resident
begin;
with r as (select id, email from app.resident where email = 'bucket@function-bucket.net')
select app_fn.assume_residency(r.id, r.email::citext)
from r;
commit;

-- -----------------------------  TENANT

-- Installs the my-app application definition
-- begin;
--     select app_fn.install_my_app_application();
-- commit;

-- Creates two customer tenants (my-app-tenant and your-app-tenant)
begin;
  select app_fn.create_tenant(
    _name => 'My App Tenant'::citext
    ,_identifier => 'my-app-tenant'::citext
    ,_email => 'my-app-tenant-admin@example.com'::citext
    ,_type => 'customer'::app.tenant_type
  );

  select app_fn.create_tenant(
    _name => 'Your App Tenant'::citext
    ,_identifier => 'your-app-tenant'::citext
    ,_email => 'your-app-tenant-admin@example.com'::citext
    ,_type => 'customer'::app.tenant_type
  );
commit;

-- Subscribes both tenants to the my-app license pack
-- begin;
--   select app_fn.subscribe_tenant_to_license_pack(
--     (select id from app.tenant where identifier = 'my-app-tenant')
--     ,'my-app'
--   );
--   select app_fn.subscribe_tenant_to_license_pack(
--     (select id from app.tenant where identifier = 'your-app-tenant')
--     ,'my-app'
--   );
-- commit;

-- Invites tenant users (admin + user roles for each tenant). The profiles already exist
-- (created above), so app_fn.invite_user attaches profile_id to each new resident itself.
begin;
  select app_fn.invite_user(id, 'my-app-tenant-admin@example.com', 'admin') from app.tenant where identifier = 'my-app-tenant';
  select app_fn.invite_user(id, 'my-app-tenant-user@example.com', 'user') from app.tenant where identifier = 'my-app-tenant';
  select app_fn.invite_user(id, 'your-app-tenant-admin@example.com', 'admin') from app.tenant where identifier = 'your-app-tenant';
  select app_fn.invite_user(id, 'your-app-tenant-user@example.com', 'user') from app.tenant where identifier = 'your-app-tenant';
  select app_fn.invite_user(id, 'our-app-tenant-user@example.com', 'user') from app.tenant where identifier = 'my-app-tenant';
  select app_fn.invite_user(id, 'our-app-tenant-user@example.com', 'user') from app.tenant where identifier = 'your-app-tenant';
  -- select app_fn.invite_user(id, 'EMAIL', 'user') from app.tenant where identifier = 'my-app-tenant';
commit;

-- Creates a Seattle location record associated with the super admin
begin;
  select loc_fn.create_location(
    row(
      null,
      'Seattle, WA',
      null,
      null,
      'Seattle',
      'WA',
      null,
      'US',
      '47.613833',
      '-122.338750'
    )::loc_fn.location_info,
    (select id from app.resident where email = 'bucket@function-bucket.net' limit 1)
  );
commit;


begin;
  UPDATE app.resident r
  SET status = 'active'
  WHERE r.ctid = (
    SELECT ctid
    FROM app.resident r2
    WHERE r2.display_name = r.display_name
      AND NOT EXISTS (
        SELECT 1
        FROM app.resident r3
        WHERE r3.display_name = r2.display_name
          AND r3.status = 'active'
      )
    ORDER BY r2.ctid
    LIMIT 1
  );
commit;
