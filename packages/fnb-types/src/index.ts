// The shared, framework-agnostic type vocabulary (type-only, except the pure URN helpers —
// the spec-authorized runtime exception, see urn.ts).
// Barrel must list every module: a missing export crashes the Node ESM loader at startup
// (not at build), pointing at dist/index.js.

export type { Urn, ParsedUrn, Resource } from '@/urn'
export { isUrn, parseUrn, formatUrn } from '@/urn'
export type { Resident, ResidentStatus, ResidentType } from '@/resident'
export type { ProfileClaims, ModuleInfo, ToolInfo, ProfileStatus } from '@/profile-claims'
export type { Location } from '@/location'
export type { MessageWithSender } from '@/message-with-sender'
export type { License, LicenseStatus } from '@/license'
export type { LicenseType, LicenseTypeAssignmentScope, LicenseTypePermission } from '@/license-type'
export type {
  LicensePack,
  LicensePackLicenseType,
  ExpirationIntervalType,
} from '@/license-pack'
export type { TenantSubscription, TenantSubscriptionStatus } from '@/tenant-subscription'
export type { Tenant, TenantStatus, TenantType } from '@/tenant'
export type { ResidencyTreeNode } from '@/residency-tree'
export type { Profile } from '@/profile'
export type { Application, Module, Tool } from '@/application'
export type { Todo, TodoStatus, TodoType } from '@/todo'
export type { SupportTicket, SupportTicketComment, SupportTicketStatus } from '@/support-ticket'
export type { LocationInfoInput } from '@/location-input'
export type { Brewery, BreweryType, BreweryMapPoint, BrewerySyncStatus } from '@/brewery'
export type {
  Airport,
  AirportType,
  Continent,
  Runway,
  AirportFrequency,
  Navaid,
  NavaidType,
  NavaidUsageType,
  NavaidPower,
  AirportMapPoint,
  AirportSyncStatus,
} from '@/airport'
export type { Asset, AssetMeta, ScanStatus, AssetStatus } from '@/asset'
