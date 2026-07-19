import { query } from '@/pool'
import { camelCaseKeys } from '@/utils/camel-case'
import type { Profile, ProfileStatus } from '@function-bucket/fnb-types'

// Pre-claims root of trust (R5 carve-out, like the login trio): called from auth-app's OIDC
// callback BEFORE any claims exist. Maps a verified ZITADEL identity ({ sub, email, name }) to
// app.profile — link by idp_user_id, else adopt by email, else create + link pending residents
// (app_fn.provision_idp_user mirrors handle_new_user). The callback trusts only a verified
// id_token; it must gate on email_verified before calling this.
// `to_jsonb(...)` + camelCaseKeys like current-profile-claims; raw-pg JSON carries the lowercase
// enum + ISO timestamp strings, so both are normalized to the fnb-types Profile shape here (R3).
export async function provisionIdpUser(
  idpUserId: string,
  email: string,
  displayName: string | null,
): Promise<Profile> {
  const rows = await query<{ profile: Record<string, unknown> }>(
    `select to_jsonb(app_fn.provision_idp_user($1::text, $2::citext, $3::citext)) as profile`,
    [idpUserId, email, displayName],
  )
  const profile = camelCaseKeys<Profile>(rows[0].profile)
  profile.status = String(profile.status).toUpperCase() as ProfileStatus
  profile.createdAt = new Date(profile.createdAt as unknown as string)
  profile.updatedAt = new Date(profile.updatedAt as unknown as string)
  return profile
}
