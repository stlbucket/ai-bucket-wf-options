# Execution log — 0030_recur__rls-permission-audit — 2026-07-22

Audit-only leg (DB fixes need sqitch changes + a redeploy the agent never runs). The only db
change since 2026-07-19 is the new **`db/fnb-notify`** module (12th db package), so this run
focused its full six-item sweep there and re-confirmed the standing findings elsewhere.

## fnb-notify sweep (notify.notification, notify.channel_preference, notify.phone_verification)

1. **RLS enabled on every table** — ✓ all three (`enable row level security` in
   `00000000011270_notify_policies.sql` + `00000000011300_notify_prefs_policies.sql`).
2. **≥1 policy using `jwt.*` helpers** — ✓
   - `notify.notification` → `view_notifications_super_admin` (SELECT) uses
     `jwt.has_permission('p:app-admin-super', tenant_id)` + the tenant-less branch.
   - `notify.channel_preference` → `channel_pref_self` (SELECT) `profile_id = jwt.profile_id()`.
   - `notify.phone_verification` → **deny-all** (RLS on, zero policy), intentional: bcrypt-hashed
     OTP rows, all access via `notify_fn`; also hidden from PostGraphile (`behavior '-*'`).
   No client INSERT/UPDATE/DELETE policies by design — all writes go through `notify_fn`.
3. **Blanket anon grants exposing DEFINER `_fn`** — ✓ NONE. `notify_fn` (SECURITY DEFINER) is
   granted only to `n8n_worker`, plus `set_channel_preference`/`verify_phone_code` explicitly to
   `authenticated`; `request_phone_verification` stays `n8n_worker`-only. Anon gets only the
   `notify_api` INVOKER surface (correct). This module does **not** add to
   `0020__security__fn-schema-grant-bypass` — it is a model of the right posture.
4. **`_api` mutations gated before `_fn`** — ✓ `notify_api.notifications` calls
   `jwt.enforce_permission('p:app-admin-super')`; `notify_api.set_channel_preference` /
   `verify_phone_code` guard on non-null `jwt.profile_id()` (deliberately not a license
   permission — any authed user manages their own prefs; the `_fn` self-binds to that profile).
5. **SECURITY DEFINER `set search_path = ''`** — ✗ **GAP.** The three `notify_fn` DEFINER writers
   (`set_channel_preference`, `request_phone_verification`, `verify_phone_code`) do not pin
   search_path, and the phone-verification pair calls **unqualified `crypt()`/`gen_salt()`**
   (pgcrypto) — the exact `auth.login_user` worked-example risk. Same class as the standing HIGH
   item; **no duplicate spawned** — folded into `identified/0050__security__security-definer-search-path`
   via a dated "Scope update — 2026-07-22" section naming the three functions + file.
6. **No superuser connections** — the notify write path correctly uses the `n8n_worker` role, not
   `postgres`. The app-wide `.env DATABASE_URL=postgresql://postgres:…` remains
   (`0040__security__superuser-database-url`, HI) — unchanged, not re-spawned.

## Standing findings re-confirmed (no duplicates spawned)

- `0020__security__fn-schema-grant-bypass` (CRT) — blanket `_fn`→anon grants elsewhere (app_fn etc.).
- `0040__security__superuser-database-url` (HI) — `.env` postgres role.
- `0050__security__security-definer-search-path` (HI) — now also covers notify_fn (see above).
- `0060__security__rls-gaps-msg-loc-app` (HI) — `app.module`/`app.tool`/`app.app_settings` RLS gap.

## Fixed inline

- `identified/0050__…search-path` — appended the 2026-07-22 scope note (three notify_fn functions).

## Spawned identified/ items

None — the one new gap belongs to an existing tracked class; everything else in fnb-notify is
correctly hardened.

## Gate

No product-code changes this leg (one `identified/*.md` edit only); `pnpm build` unaffected —
green as of the 0020 leg and re-confirmed there.
