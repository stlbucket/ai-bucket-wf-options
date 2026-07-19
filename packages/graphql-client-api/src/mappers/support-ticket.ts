import type {
  SupportTicketFragment,
  SupportTicketCommentFragment,
} from '../generated/fnb-graphql-api'
import type {
  SupportTicket,
  SupportTicketComment,
  SupportTicketStatus,
  Urn,
} from '@function-bucket/fnb-types'

export const toSupportTicket = (f: SupportTicketFragment): SupportTicket => ({
  id: String(f.id),
  tenantId: String(f.tenantId),
  tenantSubscriptionId: String(f.tenantSubscriptionId),
  residentId: String(f.residentId),
  title: f.title,
  description: f.description,
  status: f.status as unknown as SupportTicketStatus,
  createdAt: new Date(String(f.createdAt)),
  updatedAt: new Date(String(f.updatedAt)),
  urn: String(f.urn) as Urn,
})

export const toSupportTicketComment = (
  f: SupportTicketCommentFragment,
): SupportTicketComment => ({
  id: String(f.id),
  supportTicketId: String(f.supportTicketId),
  residentId: String(f.residentId),
  body: f.body,
  createdAt: new Date(String(f.createdAt)),
  updatedAt: new Date(String(f.updatedAt)),
})
