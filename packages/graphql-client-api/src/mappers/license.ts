import type { LicenseFragment } from '../generated/fnb-graphql-api'
import type { License, LicenseStatus } from '@function-bucket/fnb-types'

export const toLicense = (f: LicenseFragment): License => ({
  id: String(f.id),
  tenantId: String(f.tenantId),
  residentId: String(f.residentId),
  profileId: f.profileId != null ? String(f.profileId) : null,
  tenantSubscriptionId: String(f.tenantSubscriptionId),
  licenseTypeKey: f.licenseTypeKey,
  status: f.status as unknown as LicenseStatus,
  createdAt: new Date(String(f.createdAt)),
  updatedAt: new Date(String(f.updatedAt)),
  expiresAt: f.expiresAt != null ? new Date(String(f.expiresAt)) : null,
})
