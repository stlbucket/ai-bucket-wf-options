// Plain flat shape for app.license. Enum values mirror the GraphQL LicenseStatus enum (UPPERCASE).

export type LicenseStatus = 'ACTIVE' | 'INACTIVE' | 'EXPIRED'

export interface License {
  id: string
  tenantId: string
  residentId: string
  profileId: string | null
  tenantSubscriptionId: string
  licenseTypeKey: string
  status: LicenseStatus
  createdAt: Date
  updatedAt: Date
  expiresAt: Date | null
}
