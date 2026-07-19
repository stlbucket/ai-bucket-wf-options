// Node of the residency-switcher tree (app_api.my_residency_tree). resident* fields are null on
// ghost ancestor nodes — tenants the user can see in the hierarchy but holds no residency in.
// Enum unions mirror the GraphQL enum values verbatim (UPPERCASE) per R3.

import type { TenantType, TenantStatus } from '@/tenant'
import type { ResidentStatus, ResidentType } from '@/resident'

export interface ResidencyTreeNode {
  tenantId: string
  tenantName: string
  tenantType: TenantType
  tenantStatus: TenantStatus
  parentTenantId: string | null
  residentId: string | null
  residentStatus: ResidentStatus | null
  residentType: ResidentType | null
}
