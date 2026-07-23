import { query } from '@/pool'
import { camelCaseKeys } from '@/utils/camel-case'

// The dispatch payload from app_fn.request_otp_login. `matched` = did the opener's contact map to a
// resident of the link's tenant (D13); on a miss it is false and the rest are absent — the route
// then responds identically to a hit and sends nothing (enumeration-safe). `code` + `destinationRaw`
// are SERVER-SIDE ONLY — the route delivers the code to `destinationRaw` via the send-notification
// webhook and returns neither to the browser.
export interface OtpLoginDispatch {
  matched: boolean
  code?: string
  channel?: 'sms' | 'email'
  destinationRaw?: string
  destinationMasked?: string
}

// Pre-claims root of trust: given the opener's own phone/email (`identifier`), match it to a resident
// of the link's tenant and mint + persist an OTP code (bcrypt-hashed), returning the plaintext to the
// auth-app server for delivery. No match → `{ matched: false }` (send nothing). Raises a pg error on
// a dead link / resend cooldown — the route maps those to 429/400. Spec: .claude/specs/otp-login/.
export async function requestOtpLogin(
  deepLinkId: string,
  identifier: string,
): Promise<OtpLoginDispatch> {
  const rows = await query<Record<string, unknown>>(
    `select * from app_fn.request_otp_login($1::uuid, $2::text)`,
    [deepLinkId, identifier],
  )
  return camelCaseKeys<OtpLoginDispatch>(rows[0])
}
