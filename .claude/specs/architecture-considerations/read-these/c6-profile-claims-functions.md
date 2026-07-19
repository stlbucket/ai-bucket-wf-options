# C6 — `profile_claims_for_user` vs `current_profile_claims`

> **UPDATED at the ZITADEL cutover (2026-07-08):** `auth.user` is dropped.
> `app_fn.profile_claims_for_user(_user_id)` no longer joins `auth.user` by email — the session
> cookie now carries the **app.profile id** (minted by the OIDC callback), and the function
> resolves `app.profile` directly (`00000000010280_drop_auth_user`). The two-function split and
> everything about `current_profile_claims` below remain accurate; read "auth.user.id" as
> "app.profile.id".

Two separate SECURITY DEFINER functions assemble claims. Knowing when to call each is
critical — calling the wrong one results in either a permission error or wrong claims.

## `app_fn.profile_claims_for_user(user_id uuid)`

**Called by:** Server middleware (`getEventClaims.ts`, `getH3EventClaims.ts`)
**Input:** `auth.user.id` — read from the httpOnly `session` cookie
**Granted to:** `authenticator` role (callable without existing claims)

```sql
-- SECURITY DEFINER — runs without needing active claims
CREATE OR REPLACE FUNCTION app_fn.profile_claims_for_user(_user_id uuid)
  RETURNS app_fn.profile_claims LANGUAGE sql SECURITY DEFINER AS $$
  SELECT app_fn.current_profile_claims(p.id)
  FROM app.profile p
  JOIN auth.user u ON u.email = p.email
  WHERE u.id = _user_id
$$;
```

Solves the bootstrap problem: the session cookie only contains the auth user ID, but claims
require knowing the profile → resident → permissions chain. This function bridges auth.user
to app.profile via email, then delegates to `current_profile_claims`.

**Use when:** You have a user ID but no claims yet (middleware bootstrap).

---

## `app_fn.current_profile_claims(profile_id uuid)`

**Called by:** Login route, `profile_claims_for_user`, any API route that needs to refresh claims
**Input:** `app.profile.id`

```sql
-- Assembles full ProfileClaims from profile → active resident → licenses
-- Returns minimal claims (no tenant context) if no active resident found
```

Assembles the full `ProfileClaims` composite type:
1. SELECT profile WHERE id = profile_id
2. SELECT active resident WHERE profile_id = profile_id AND status = 'active'
3. SELECT home resident WHERE profile_id = profile_id AND type = 'home'
4. SELECT permissions via license → license_type_permission join
5. Returns ProfileClaims with all fields populated

**Use when:** You already have a profile_id and need to refresh/assemble claims — e.g. after
`become_support`, `exit_support_mode`, or login.

---

## Quick Reference

| | `profile_claims_for_user` | `current_profile_claims` |
|--|--------------------------|-------------------------|
| Input | auth.user.id (UUID) | app.profile.id (UUID) |
| Callable without claims | YES (granted to authenticator) | YES (SECURITY DEFINER) |
| Called from | Server middleware | Login route, post-session-change |
| Joins | auth.user → app.profile via email | profile → resident → licenses |
