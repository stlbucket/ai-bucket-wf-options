// Plain flat shapes for support.support_ticket and support.support_ticket_comment.
// status mirrors the GraphQL SupportTicketStatus enum (UPPERCASE).

export type SupportTicketStatus = 'OPEN' | 'CLOSED' | 'DELETED' | 'DUPLICATE' | 'PARKED'

import type { Urn } from '@/urn'

export interface SupportTicket {
  id: string
  tenantId: string
  tenantSubscriptionId: string
  residentId: string
  title: string
  description: string
  status: SupportTicketStatus
  createdAt: Date
  updatedAt: Date
  urn: Urn
}

export interface SupportTicketComment {
  id: string
  supportTicketId: string
  residentId: string
  body: string
  createdAt: Date
  updatedAt: Date
}
