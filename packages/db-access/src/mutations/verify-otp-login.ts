import { query } from '@/pool'

// Pre-claims root of trust: verify the code for a deep link. On success app_fn.verify_otp_login has
// already activated the URN's tenant as the workspace and minted an OTP auth.session — it returns
// { sid, profileId } which the route seals into the cookie. A bad/expired/attempts-exhausted code
// comes back as a null row → null here (route → 401). A no-residency condition RAISES inside the fn
// (message NO_RESIDENCY_IN_TENANT) and propagates as a pg error (route → 403).
// Spec: .claude/specs/otp-login/.
export async function verifyOtpLogin(
  deepLinkId: string,
  code: string,
): Promise<{ sid: string; profileId: string } | null> {
  const rows = await query<{ sid: string | null; profile_id: string | null }>(
    `select * from app_fn.verify_otp_login($1::uuid, $2::text)`,
    [deepLinkId, code],
  )
  const row = rows[0]
  if (!row?.sid || !row.profile_id) return null
  return { sid: row.sid, profileId: row.profile_id }
}
