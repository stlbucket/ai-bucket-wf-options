// Mapper: generated GraphQL ResidentFragment → the shared fnb-types Resident.
// Pure, no reactivity. Un-Maybes optional selections and coerces custom-scalar `any`
// (UUID → string, Datetime → Date). Enum values pass through unchanged: fnb-types enum
// values mirror the GraphQL enum values verbatim, so no casing normalization is needed
// (the cast bridges the generated TS enum to the fnb-types string-literal union).

import type { ResidentFragment } from '../generated/fnb-graphql-api'
import type { Resident, ResidentStatus, ResidentType, Urn } from '@function-bucket/fnb-types'

export const toResident = (f: ResidentFragment): Resident => ({
  id: String(f.id),
  profileId: f.profileId != null ? String(f.profileId) : null,
  invitedByProfileId: f.invitedByProfileId != null ? String(f.invitedByProfileId) : null,
  invitedByDisplayName: f.invitedByDisplayName ?? null,
  tenantId: String(f.tenantId),
  tenantName: f.tenantName,
  email: f.email,
  displayName: f.displayName ?? null,
  createdAt: new Date(String(f.createdAt)),
  updatedAt: new Date(String(f.updatedAt)),
  status: f.status as unknown as ResidentStatus,
  type: f.type as unknown as ResidentType,
  urn: String(f.urn) as Urn,
})
