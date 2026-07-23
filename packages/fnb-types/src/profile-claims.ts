// Source of truth for ProfileClaims and its nested composites. Plain flat interfaces — no Kysely
// wrappers, deliberately NOT derived from graphql codegen (which would invert dependency direction,
// make every field Maybe<> and carry a required __typename). Shapes mirror app_fn.profile_claims /
// app_fn.module_info / app_fn.tool_info.
//
// ProfileStatus values mirror the GraphQL API enum values verbatim (UPPERCASE). The GraphQL claims
// path already yields these; db-access normalizes its raw-pg (lowercase) value up to match.

import type { ResidencyTreeNode } from '@/residency-tree'
import type { TenantType } from '@/tenant'

export type ProfileStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED'

export interface ToolInfo {
  key: string | null
  name: string | null
  permissionKeys: string[] | null
  defaultIconKey: string | null
  route: string | null
  ordinal: number | null
}

export interface ModuleInfo {
  key: string | null
  name: string | null
  permissionKeys: string[] | null
  defaultIconKey: string | null
  ordinal: number | null
  tools: ToolInfo[] | null
}

export interface ProfileClaims {
  profileId: string | null
  tenantId: string | null
  residentId: string | null
  actualResidentId: string | null
  profileStatus: ProfileStatus | null
  permissions: string[] | null
  email: string | null
  displayName: string | null
  tenantName: string | null
  // The active residency's tenant type — gates workspace-only UI (e.g. Manage Residents).
  // Mirrors the GraphQL TenantType enum (UPPERCASE); db-access uppercases the raw-pg value.
  tenantType: TenantType | null
  modules: ModuleInfo[] | null
  // Populated only by the GraphQL claims path (fetchProfileClaims); the raw-pg server path
  // (db-access) leaves it null — app_fn.profile_claims deliberately has no such field.
  residencies: ResidencyTreeNode[] | null
}
