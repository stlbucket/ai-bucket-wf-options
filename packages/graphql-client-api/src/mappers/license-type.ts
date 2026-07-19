import type {
  LicenseTypeFragment,
  LicenseTypePermissionFragment,
} from '../generated/fnb-graphql-api'
import type {
  LicenseType,
  LicenseTypeAssignmentScope,
  LicenseTypePermission,
} from '@function-bucket/fnb-types'

export const toLicenseType = (f: LicenseTypeFragment): LicenseType => ({
  key: f.key,
  applicationKey: f.applicationKey,
  displayName: f.displayName,
  assignmentScope: f.assignmentScope as unknown as LicenseTypeAssignmentScope,
  createdAt: new Date(String(f.createdAt)),
  updatedAt: new Date(String(f.updatedAt)),
})

export const toLicenseTypePermission = (
  f: LicenseTypePermissionFragment,
): LicenseTypePermission => ({
  licenseTypeKey: f.licenseTypeKey,
  permissionKey: f.permissionKey,
})
