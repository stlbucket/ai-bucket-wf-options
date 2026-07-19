import { query } from '@/pool'

// Pre-claims root of trust (R5 carve-out): called by auth-app's OIDC callback right after
// provisionIdpUser. Inserts the auth.session row and returns its id, which the callback seals
// into the `session` cookie as `sid`. The cookie is written only at login — renewal is a
// server-side row touch inside claimsForSession, never a re-seal.
// Spec: .claude/specs/future-auth/session-refresh-pattern.md.
export async function createSession(profileId: string): Promise<string> {
  const rows = await query<{ id: string }>(`select app_fn.create_session($1::uuid) as id`, [
    profileId,
  ])
  return rows[0].id
}
