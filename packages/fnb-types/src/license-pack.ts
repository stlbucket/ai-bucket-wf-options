// Plain flat shapes for app.license_pack and app.license_pack_license_type.
// expirationIntervalType mirrors the GraphQL ExpirationIntervalType enum (UPPERCASE).

export type ExpirationIntervalType =
  | 'NONE'
  | 'DAY'
  | 'WEEK'
  | 'MONTH'
  | 'QUARTER'
  | 'YEAR'
  | 'EXPLICIT'

export interface LicensePack {
  key: string
  displayName: string
  description: string | null
  autoSubscribe: boolean
  createdAt: Date
  updatedAt: Date
}

export interface LicensePackLicenseType {
  id: string
  licensePackKey: string
  licenseTypeKey: string
  numberOfLicenses: number
  expirationIntervalType: ExpirationIntervalType
  expirationIntervalMultiplier: number
  issuedCount: number
}
