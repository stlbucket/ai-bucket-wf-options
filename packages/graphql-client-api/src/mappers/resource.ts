import type { ResourceFieldsFragment } from '../generated/fnb-graphql-api'
import type { Resource, Urn } from '@function-bucket/fnb-types'

// Bridges the internal generated ResourceFieldsFragment → the shared fnb-types Resource (R3).
// Un-Maybes ids, coerces scalars (UUID→string, Datetime→Date), brands the urn.
export const toResource = (f: ResourceFieldsFragment): Resource => ({
  id: String(f.id),
  tenantId: String(f.tenantId),
  module: String(f.module),
  resourceType: String(f.resourceType),
  urn: String(f.urn) as Urn,
  createdAt: new Date(String(f.createdAt)),
  createdByResidentId: f.createdByResidentId != null ? String(f.createdByResidentId) : null,
  archivedAt: f.archivedAt != null ? new Date(String(f.archivedAt)) : null,
})
