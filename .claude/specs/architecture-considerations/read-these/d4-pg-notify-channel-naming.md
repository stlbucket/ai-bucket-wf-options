# D4 — pg NOTIFY Channel Naming

## Channel Name Pattern

```
topic:<topicId>:message
```

Example: `topic:550e8400-e29b-41d4-a716-446655440000:message` (50 chars, within PostgreSQL's 63-byte identifier limit)

## How It Works

**DB side** — the `_500_topic_msg_insert` trigger on `msg.message` calls `app_fn.tg__topic_subscription`:
```sql
EXECUTE FUNCTION app_fn.tg__topic_subscription(
  'create',
  'topic:$1:message',
  'topic_id'
);
```
The trigger function substitutes `$1` with the row's `topic_id` value at runtime.

**Node.js side** — the WebSocket handler (`server/routes/_ws/topics/[id]/messages.ts`) subscribes using the same pattern:
```typescript
await useNitroApp().pgBridge.subscribe(`topic:${topicId}:message`, peer)
```

`topicId` is extracted from the URL path and validated against a UUID regex before use. The pg-notify bridge issues `LISTEN`/`UNLISTEN` with the channel name double-quoted:
```sql
LISTEN "topic:550e8400-e29b-41d4-a716-446655440000:message"
```

PostgreSQL channel names are case-sensitive and sent as-is in notification payloads.
