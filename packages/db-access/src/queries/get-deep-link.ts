import { query } from '@/pool'
import { camelCaseKeys } from '@/utils/camel-case'

// The non-sensitive projection of an auth.deep_link for the OTP landing page. `id` null + both flags
// true ⇒ the link is unknown/dead. Tenant-scoped (D13): no recipient/channel/destination — the
// opener supplies their own contact at request time.
export interface DeepLinkPublic {
  id: string | null
  subjectUrn: string | null
  subjectLabel: string | null
  module: string | null
  expired: boolean
  revoked: boolean
}

// Pre-claims root of trust (R5 carve-out): the OTP landing page (/auth/go/[id]) reads a deep link
// before any session exists. app_fn.get_deep_link returns only masked, non-sensitive fields; an
// unknown/expired/revoked id comes back with the flags set so the page renders a dead-link state.
// Spec: .claude/specs/otp-login/.
export async function getDeepLink(id: string): Promise<DeepLinkPublic> {
  const rows = await query<Record<string, unknown>>(`select * from app_fn.get_deep_link($1::uuid)`, [
    id,
  ])
  return camelCaseKeys<DeepLinkPublic>(rows[0])
}
