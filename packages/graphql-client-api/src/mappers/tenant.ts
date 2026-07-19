import type { TenantFragment } from '../generated/fnb-graphql-api'
import type { Tenant, TenantStatus, TenantType, Urn } from '@function-bucket/fnb-types'

export const toTenant = (f: TenantFragment): Tenant => ({
  id: String(f.id),
  name: f.name,
  identifier: f.identifier ?? null,
  type: f.type as unknown as TenantType,
  status: f.status as unknown as TenantStatus,
  parentTenantId: f.parentTenantId != null ? String(f.parentTenantId) : null,
  createdAt: new Date(String(f.createdAt)),
  updatedAt: new Date(String(f.updatedAt)),
  urn: String(f.urn) as Urn,
})
