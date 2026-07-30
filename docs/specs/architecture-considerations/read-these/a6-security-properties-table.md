# A6 — Security Properties Enforcement Table

How each security property is enforced in the fnb stack.

| Property | How Enforced |
|----------|-------------|
| No cross-tenant data leakage | `auth.tenant_id()` check in every tenant-scoped RLS policy — rows from other tenants are simply invisible |
| Permission changes take effect immediately | Server middleware re-fetches claims from DB on every request via session cookie — stale auth.user cookie is never trusted for server-side decisions |
| No JWT forgery | "JWT" payload is built server-side from DB data and stored in Postgres session config — it is never a signed token passed from the client. Client cannot inject claims. |
| Password security | `auth.login_user()` uses pgcrypto's `crypt()` with bcrypt — passwords are never stored plaintext |
| Session theft resistance | Session cookie is httpOnly — JavaScript (including XSS payloads) cannot read the session ID |
| Transaction-local claims | `set_config('request.jwt.claims', payload, true)` — the `true` flag makes it transaction-local, cleared at COMMIT/ROLLBACK. No state leaks between requests even on shared connections. |
| Superadmin isolation | `app-admin-super` license type can only exist in the `anchor` license pack (partial unique index). Only one tenant can subscribe to `anchor` pack. Together: super admin licenses are structurally impossible outside the anchor tenant. |
| Self-modification prevention | `app_fn.grant_user_license` checks caller's resident ID ≠ target resident ID before deleting scoped licenses — admins cannot accidentally revoke their own access |
| Invited user isolation | `view_own_resident_email` RLS policy matches on email before profile exists — invited users can only see their own pending invitation |
