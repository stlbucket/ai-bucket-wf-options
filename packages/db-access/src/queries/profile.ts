import type { PoolClient } from 'pg'

// Returns the CALLING user's own ZITADEL idp_user_id. Must run within a withClaims transaction:
// RLS `view_self` on app.profile (jwt.uid() = id) plus the explicit `where id = jwt.uid()` restrict
// this to the caller's own row (jwt.uid() is always the caller's profile id, so even a super-admin's
// manage-all policy cannot widen it). Used by the change-password route (password-self-service spec)
// to find the ZITADEL user to re-key — the "only the owning user" RLS gate. Null when the profile
// has never OIDC-logged-in (idp_user_id unset).
export async function selectMyIdpUserId(client: PoolClient): Promise<string | null> {
  const { rows } = await client.query<{ idp_user_id: string | null }>(
    `select idp_user_id from app.profile where id = jwt.uid()`,
  )
  return rows[0]?.idp_user_id ?? null
}
