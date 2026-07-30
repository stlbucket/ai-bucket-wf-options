# Plan: `change-password.post.ts` returns success without verifying or changing anything

> **Execution Directive:** Implement via the `fnb-stack-implementor` skill (+ `fnb-db-designer` for the DB fn).
> Invoke: `/fnb-stack-implementor .claude/issues/identified/change-password-stub.plan.md`
> Gate is `pnpm build`. Never run `git`; never rebuild Docker yourself — ask the user, then verify read-only.

**Severity: HIGH** · Workstream: WS3 (app auth) · Identified: 2026-07-05

## Details

`apps/auth-app/server/api/auth/change-password.post.ts` checks that a `session` cookie exists
(line 16) and then, at lines 27-28:

```ts
// STUB: no actual password verification
return { success: true }
```

It never verifies `currentPassword`, never hashes/stores `newPassword`, never touches the database.
Callers receive `{ success: true }` while nothing changes. The client wiring exists:
`packages/auth-ui/src/use-auth.ts:67-72` exposes `changePassword`, and
`packages/auth-layer/app/components/ChangePasswordForm.vue` renders the form.

There is also no `auth.change_password` (or equivalent) function in the DB — `db/fnb-auth/deploy/`
has `auth.login_user` but no password-update routine. (`a092d9b8 remove encrypted_password field`
and related history suggest the auth schema was reworked; the change-password path was never
rebuilt.)

## Implication

Users believe their password changed when it did not — a security-relevant false assurance
(a user reacting to a suspected compromise gets no actual protection). It's also a latent hole: the
moment someone "fixes the form" without noticing the stub, they may wire it to something that
accepts arbitrary input. Best resolved by making it real or removing it, not leaving a lying stub.

## Suggested fix

Preferred — implement it end to end:
1. DB: add `auth.change_password(_current text, _new text)` (SECURITY DEFINER,
   `SET search_path = ''`, schema-qualified `crypt`/`gen_salt`) that verifies the current password
   against the caller's row (identified by `jwt.uid()` under claims, or by the userId the endpoint
   passes from the session), then updates the bcrypt hash. Enforce a minimum length. One sqitch
   change in `db/fnb-auth`. Follow the hardening in `security-definer-search-path.plan.md`.
2. db-access: add a raw-pg mutation `changePassword(userId, current, new)` in
   `packages/db-access/src/mutations/` (this is a pre-claims-adjacent credential op — keep it in the
   root of trust, not GraphQL) and export it from the barrel.
3. Endpoint: `change-password.post.ts` reads the session userId (via the sealed session from
   `session-cookie-signing.plan.md`), calls the db-access mutation, returns 200 or a 400/401 on
   bad current password. No info leak in the error.
4. auth-ui: after success, call `refreshClaims()` (currently missing — see `auth-ui-hardening.plan.md`).

Fallback if password change is not a near-term feature: remove the endpoint, the `changePassword`
export from auth-ui, and `ChangePasswordForm.vue` (and its route/usage), so nothing advertises a
capability that doesn't exist.

## Verification

- Wrong current password → 401/400, hash unchanged (`select hashed_password from auth.user` before/after).
- Correct current password → hash changes; can log in with new password, not old.
- `pnpm build` green; user restarts stack; verified read-only via the form + login.
