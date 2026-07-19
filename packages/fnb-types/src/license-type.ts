// Plain flat shapes for app.license_type and app.license_type_permission.
// assignmentScope mirrors the GraphQL LicenseTypeAssignmentScope enum (UPPERCASE).

export type LicenseTypeAssignmentScope =
  | 'USER'
  | 'ADMIN'
  | 'SUPERADMIN'
  | 'SUPPORT'
  | 'NONE'
  | 'ALL'

export interface LicenseType {
  key: string
  applicationKey: string
  displayName: string
  assignmentScope: LicenseTypeAssignmentScope
  createdAt: Date
  updatedAt: Date
}

export interface LicenseTypePermission {
  licenseTypeKey: string
  permissionKey: string
}
