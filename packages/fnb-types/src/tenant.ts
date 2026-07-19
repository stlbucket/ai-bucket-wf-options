// Plain flat shape for app.tenant (replaces the old TenantSummary view).
// status/type mirror the GraphQL TenantStatus / TenantType enums (UPPERCASE).

export type TenantStatus = 'ACTIVE' | 'INACTIVE' | 'PAUSED'

export type TenantType = 'ANCHOR' | 'CUSTOMER' | 'DEMO' | 'TEST' | 'TRIAL' | 'WORKSPACE'

import type { Urn } from '@/urn'

export interface Tenant {
  id: string
  name: string
  identifier: string | null
  type: TenantType
  status: TenantStatus
  parentTenantId: string | null
  createdAt: Date
  updatedAt: Date
  urn: Urn
}
