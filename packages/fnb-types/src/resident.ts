// Plain, framework-agnostic shape for app.resident — the shared vocabulary across the stack.
// Both sources normalize to this: db-access yields it from raw pg; graphql-client-api's
// toResident mapper builds it from the generated ResidentFragment. No Maybe<>, no __typename.

// Enum values mirror the GraphQL API enum values verbatim (rule: fnb-types enum values ==
// their corresponding GraphQL enum values). GraphQL exposes these UPPERCASE.
export type ResidentStatus =
  | 'INVITED'
  | 'DECLINED'
  | 'ACTIVE'
  | 'INACTIVE'
  | 'BLOCKED_INDIVIDUAL'
  | 'BLOCKED_TENANT'
  | 'SUPPORTING'

export type ResidentType = 'HOME' | 'GUEST' | 'SUPPORT'

import type { Urn } from '@/urn'

export interface Resident {
  id: string
  profileId: string | null
  invitedByProfileId: string | null
  invitedByDisplayName: string | null
  tenantId: string
  tenantName: string
  email: string
  displayName: string | null
  createdAt: Date
  updatedAt: Date
  status: ResidentStatus
  type: ResidentType
  urn: Urn
}
