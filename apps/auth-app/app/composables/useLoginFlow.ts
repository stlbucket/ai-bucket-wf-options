import type { Client } from '@urql/vue'
import { assumeResidency as gqlAssumeResidency } from '@function-bucket/fnb-graphql-client-api'

// Residency operations for the login flow. These run through GraphQL (the old REST routes were
// deleted once claims stopped being cookie-backed); callers refresh claims afterwards via useAuth.
// fetchMyResidencies is gone: residencies ride ProfileClaims (refreshClaims populates
// user.residencies — .claude/specs/workspace-switcher/), so the login page reads claims directly.
export function assumeResidency(client: Client, residentId: string): Promise<void> {
  return gqlAssumeResidency(client, residentId)
}
