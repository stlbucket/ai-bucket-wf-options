import type { TenantSubscriptionFragment } from '../generated/fnb-graphql-api'
import type { TenantSubscription, TenantSubscriptionStatus } from '@function-bucket/fnb-types'

export const toTenantSubscription = (f: TenantSubscriptionFragment): TenantSubscription => ({
  id: String(f.id),
  tenantId: String(f.tenantId),
  licensePackKey: f.licensePackKey,
  status: f.status as unknown as TenantSubscriptionStatus,
  createdAt: new Date(String(f.createdAt)),
  updatedAt: new Date(String(f.updatedAt)),
})
