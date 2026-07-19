// Plain flat shape for app.tenant_subscription.
// status mirrors the GraphQL TenantSubscriptionStatus enum (UPPERCASE).

export type TenantSubscriptionStatus = 'ACTIVE' | 'INACTIVE'

export interface TenantSubscription {
  id: string
  tenantId: string
  licensePackKey: string
  status: TenantSubscriptionStatus
  createdAt: Date
  updatedAt: Date
}
