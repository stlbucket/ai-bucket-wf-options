import type { PoolClient } from 'pg'
import { camelCaseKeys } from '@/utils/camel-case'
import type { MessageWithSender } from '@function-bucket/fnb-types'

// Incremental "new message" read for the WebSocket path. Must run within a withClaims transaction
// (RLS on msg.message + res.resource + app.resident). Raw pg — snake_case columns are camelCased
// to match MessageWithSender. Sender resolves through the registry: posted_by_resident_urn →
// res.resource → app.resident.
export async function selectMessageWithSenderById(
  client: PoolClient,
  id: string,
): Promise<MessageWithSender | undefined> {
  const { rows } = await client.query(
    `select m.id, m.topic_id, m.content, m.created_at, m.status, m.posted_by_resident_urn,
            r.display_name as sender_display_name
       from msg.message m
       left join res.resource rr on rr.urn = m.posted_by_resident_urn
       left join app.resident r on r.id = rr.id
      where m.status != 'deleted' and m.id = $1`,
    [id],
  )
  return rows[0] ? camelCaseKeys<MessageWithSender>(rows[0]) : undefined
}
