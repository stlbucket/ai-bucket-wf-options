-- Production one-off: seed the support identity app_settings rows that db/seed.sql
-- (full dev seed) provides but the empty-bootstrapped prod env never got.
-- become_support falls back to 'support@example.com' / 'Site Support' without these.
-- Edit the two values below to the real support identity before running.
insert into app.app_settings (application_key, key, display_name, value) values
  ('base', 'support-email', 'Site Support Email', 'site-support@example.com')
on conflict (key) do update set value = excluded.value;

insert into app.app_settings (application_key, key, display_name, value) values
  ('base', 'support-display-name', 'Site Support Display Name', 'Site Support')
on conflict (key) do update set value = excluded.value;
