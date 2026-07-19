// Shape for the WebSocket incremental "new message" read (msg.message joined via
// res.resource to app.resident for the sender display name). Produced by db-access's
// selectMessageWithSenderById (WS carve-out).

import type { Urn } from '@/urn'

export interface MessageWithSender {
  id: string
  topicId: string
  content: string
  createdAt: Date
  status: string
  postedByResidentUrn: Urn
  senderDisplayName: string | null
}
