import type {
  LicensePackFragment,
  LicensePackLicenseTypeFragment,
} from '../generated/fnb-graphql-api'
import type {
  LicensePack,
  LicensePackLicenseType,
  ExpirationIntervalType,
} from '@function-bucket/fnb-types'

export const toLicensePack = (f: LicensePackFragment): LicensePack => ({
  key: f.key,
  displayName: f.displayName,
  description: f.description ?? null,
  autoSubscribe: f.autoSubscribe,
  createdAt: new Date(String(f.createdAt)),
  updatedAt: new Date(String(f.updatedAt)),
})

export const toLicensePackLicenseType = (
  f: LicensePackLicenseTypeFragment,
): LicensePackLicenseType => ({
  id: String(f.id),
  licensePackKey: f.licensePackKey,
  licenseTypeKey: f.licenseTypeKey,
  numberOfLicenses: f.numberOfLicenses,
  expirationIntervalType: f.expirationIntervalType as unknown as ExpirationIntervalType,
  expirationIntervalMultiplier: f.expirationIntervalMultiplier,
  issuedCount: f.issuedCount ?? 0,
})
