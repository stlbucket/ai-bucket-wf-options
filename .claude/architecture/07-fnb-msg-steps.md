# Adding the fnb-msg Stack — Step-by-Step

## What Already Exists vs What Needs Building

### Already exists (DB layer is complete)
- `db/fnb-msg/` — full sqitch package deployed
- `msg.topic`, `msg.message`, `msg.subscriber`, `msg.msg_tenant`, `msg.msg_resident` tables
- `msg_api.upsert_topic`, `msg_api.upsert_message`, `msg_api.upsert_subscriber`, `msg_api.deactivate_subscriber`, `msg_api.delete_topic`
- `app_fn.tg__graphql_subscription` — real-time trigger that fires `pg_notify` on `msg.message` INSERT
- RLS policies on all msg tables (require `p:discussions` permission)
- `msg_fn.ensure_msg_resident()` — lazy-create shadow resident on first use

### NOT yet built
- `p:discussions` license type installed in any license pack (DB seed step needed)
- TypeScript types and query helpers in `packages/db-types`
- Nuxt layer package for msg
- Nuxt app for msg (or integration into existing app)
- Server API routes
- Vue pages and components
- Nav section registration
- Real-time WebSocket wiring

---

## Architecture Decision: Separate App or Integrated?

**Option A: New `packages/msg-layer` + `apps/msg-app`** (follows the established pattern)
- Pros: clean separation, own port/subdomain, independently deployable
- Cons: another app to maintain, another nav registration

**Option B: Add msg pages/routes into `tenant-app`**
- Pros: already has tenant-scoped routes and auth infrastructure
- Cons: couples feature to tenant-app

This guide follows **Option A** (separate layer + app), matching the project's established pattern. However Phase 3 notes can be adapted for Option B.

---

## Phase 1 — Database: Install the Msg Application

The `fnb-msg` DB tables and functions exist, but the `p:discussions` license type has never been installed into the `app.license_type` / `app.permission` tables. Add a sqitch change to `db/my-app` (or a new `db/fnb-msg-app` package) that calls `install_basic_application`:

### File: `db/fnb-msg-app/deploy/00000000010600_msg_app.sql`

```sql
begin;

SELECT app_fn.install_basic_application(
  'msg-app'::citext,
  'Discussions'::citext,
  'Multi-user chat and topic discussions'::citext,
  true,  -- auto_subscribe: all new tenants get it
  ARRAY[
    ROW(
      'msg-module'::citext,
      'Discussions'::citext,
      ARRAY['p:discussions']::citext[],
      'i-lucide-message-circle'::citext,
      10,  -- ordinal
      ARRAY[
        ROW(
          'msg-topics'::citext,
          'Topics'::citext,
          ARRAY['p:discussions']::citext[],
          'i-lucide-messages-square'::citext,
          '/messages'::citext,
          1
        )::app_fn.tool_info
      ]::app_fn.tool_info[]
    )::app_fn.module_info
  ]::app_fn.module_info[]
);

commit;
```

**What this creates:**
- `app.application` record: `msg-app`
- `app.module` record: `msg-module`
- `app.tool` record: `msg-topics` with route `/messages`
- `app.license_type` records: `msg-app` (user scope), `msg-app-admin` (admin scope)
- `app.permission` records: `p:discussions`, `p:discussions-admin`
- `app.license_pack` record: `msg-app` with auto_subscribe=true
- Auto-subscribes all existing tenants and sets up their licenses

**After deploying:** every user with the `msg-app` user license will have `p:discussions` in their ProfileClaims.permissions.

---

## Phase 2 — db-types: TypeScript Types and Query Helpers

### 2a. Regenerate types

```bash
pnpm db-generate
```

This runs Kanel and regenerates `packages/db-types/src/generated/fnb-msg/msg/` with TypeScript types for `Topic`, `Message`, `Subscriber`, `MsgTenant`, `MsgResident`.

### 2b. Add query helpers

**File: `packages/db-types/src/queries/msg.ts`**

```typescript
import type { Kysely, Transaction } from 'kysely'
import type { Database } from '../db'

export function selectTopicsByTenantId(db: Kysely<Database> | Transaction<Database>, tenantId: string) {
  return db
    .selectFrom('msg.topic')
    .where('tenant_id', '=', tenantId)
    .orderBy('created_at', 'desc')
    .selectAll()
    .execute()
}

export function selectTopicById(db: Kysely<Database> | Transaction<Database>, id: string) {
  return db
    .selectFrom('msg.topic')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

export function selectMessagesByTopicId(db: Kysely<Database> | Transaction<Database>, topicId: string) {
  return db
    .selectFrom('msg.message')
    .where('topic_id', '=', topicId)
    .where('status', '!=', 'deleted')
    .orderBy('created_at', 'asc')
    .selectAll()
    .execute()
}

export function selectSubscribersByTopicId(db: Kysely<Database> | Transaction<Database>, topicId: string) {
  return db
    .selectFrom('msg.subscriber')
    .where('topic_id', '=', topicId)
    .selectAll()
    .execute()
}
```

### 2c. Add mutation wrappers

**File: `packages/db-types/src/mutations/fnb-msg/upsert-topic.ts`**

```typescript
import { sql } from 'kysely'
import type { Kysely, Transaction } from 'kysely'
import type { Database } from '../../db'

export async function upsertTopic(
  db: Kysely<Database> | Transaction<Database>,
  topicInfo: { name: string; identifier?: string; status?: string }
) {
  const { rows } = await sql<{ upsert_topic: unknown }>`
    SELECT msg_api.upsert_topic(ROW(
      NULL::uuid,
      ${sql.val(topicInfo.name)}::citext,
      ${sql.val(topicInfo.identifier ?? null)}::citext,
      ${sql.val(topicInfo.status ?? 'open')}::msg.topic_status
    )::msg_fn.topic_info)
  `.execute(db)
  return rows[0]
}
```

**File: `packages/db-types/src/mutations/fnb-msg/upsert-message.ts`**

```typescript
export async function upsertMessage(
  db: Kysely<Database> | Transaction<Database>,
  messageInfo: { topicId?: string; content: string; tags?: string[] }
) {
  const { rows } = await sql<{ upsert_message: unknown }>`
    SELECT msg_api.upsert_message(ROW(
      NULL::uuid,
      ${sql.val(messageInfo.topicId ?? null)}::uuid,
      ${sql.val(messageInfo.content)}::citext,
      ${sql.val(messageInfo.tags ?? [])}::text[]
    )::msg_fn.message_info)
  `.execute(db)
  return rows[0]
}
```

### 2d. Export from db-types index

**File: `packages/db-types/src/index.ts`** — add:
```typescript
export * as msgQueries from './queries/msg'
export * as msgFn from './mutations/fnb-msg/upsert-topic'
// etc.
```

---

## Phase 3 — Nuxt Layer: `packages/msg-layer`

Create a new Nuxt layer that extends `auth-layer` and registers the msg navigation section.

### File: `packages/msg-layer/package.json`

```json
{
  "name": "@function-bucket/fnb-msg-layer",
  "version": "0.0.1",
  "dependencies": {
    "@function-bucket/fnb-auth-layer": "workspace:*",
    "@function-bucket/fnb-db-types": "workspace:*"
  }
}
```

### File: `packages/msg-layer/nuxt.config.ts`

```typescript
export default defineNuxtConfig({
  extends: ['@function-bucket/fnb-auth-layer'],
})
```

### File: `packages/msg-layer/app/plugins/nav-register.ts`

```typescript
export default defineNuxtPlugin(() => {
  const { register } = useNavRegistry()
  register([
    {
      title: 'Discussions',
      permissionKey: 'p:discussions',
      items: [
        { label: 'Topics', route: '/messages', icon: 'i-lucide-messages-square' },
      ]
    }
  ])
})
```

---

## Phase 4 — Nuxt App: `apps/msg-app`

### File: `apps/msg-app/package.json`

```json
{
  "name": "@function-bucket/msg-app",
  "dependencies": {
    "@function-bucket/fnb-msg-layer": "workspace:*",
    "@function-bucket/fnb-db-types": "workspace:*"
  },
  "scripts": {
    "dev": "nuxt dev --port 4002",
    "build": "nuxt build"
  }
}
```

### File: `apps/msg-app/nuxt.config.ts`

```typescript
export default defineNuxtConfig({
  extends: ['@function-bucket/fnb-msg-layer'],
  runtimeConfig: {
    cookieDomain: '',
    public: {
      authAppUrl: process.env.AUTH_APP_URL ?? 'http://localhost:4000/auth',
    }
  },
  nitro: {
    experimental: { websocket: true }
  }
})
```

### File: `apps/msg-app/app/pages/messages/index.vue`

```vue
<script setup lang="ts">
const { data: topics, refresh } = await useFetch('/api/topics')
</script>

<template>
  <UCard header="Topics">
    <TopicList :topics="topics" />
    <UButton @click="newTopicModalOpen = true">New Topic</UButton>
  </UCard>
</template>
```

### File: `apps/msg-app/app/pages/messages/[id].vue`

```vue
<script setup lang="ts">
const route = useRoute()
const { data: topic } = await useFetch(`/api/topics/${route.params.id}`)
const { data: messages, refresh } = await useFetch(`/api/topics/${route.params.id}/messages`)

// TODO Phase 6: subscribe to real-time updates via WebSocket
</script>

<template>
  <div class="flex flex-col h-full">
    <UCard class="flex-1 overflow-y-auto">
      <MessageThread :messages="messages" />
    </UCard>
    <MessageComposer :topic-id="route.params.id" @sent="refresh()" />
  </div>
</template>
```

### Components to create:

| Component | File | Props |
|-----------|------|-------|
| `TopicList` | `app/components/TopicList.vue` | `topics: Topic[]` |
| `MessageThread` | `app/components/MessageThread.vue` | `messages: Message[]` |
| `MessageComposer` | `app/components/MessageComposer.vue` | `topicId: string`, emits `sent` |

---

## Phase 5 — Server API Routes

All routes live in `apps/msg-app/server/api/`.

### File: `server/middleware/auth.ts`

```typescript
// Copy pattern from apps/tenant-app/server/middleware/auth.ts
import { getH3EventClaims } from './_common/get-h3-event-claims'

export default defineEventHandler(async (event) => {
  const { user, claims } = await getH3EventClaims(event)
  event.context.user = user
  event.context.claims = claims
})
```

### File: `server/plugins/db.ts`

```typescript
// Copy pattern from apps/tenant-app/server/plugins/db.ts
import { createDb } from '@function-bucket/fnb-db-types'

export default defineNitroPlugin((nitro) => {
  const db = createDb(process.env.DATABASE_URL!)
  nitro.hooks.hook('request', (event) => {
    event.context.db = db
  })
})
```

### File: `server/api/topics/index.get.ts`

```typescript
import { withClaims, msgQueries } from '@function-bucket/fnb-db-types'

export default defineEventHandler(async (event) => {
  const { db, claims } = event.context
  if (!claims) throw createError({ statusCode: 401 })

  const topics = await withClaims(db, claims, (trx) =>
    msgQueries.selectTopicsByTenantId(trx, claims.tenantId!)
  )
  return topics
})
```

### File: `server/api/topics/index.post.ts`

```typescript
import { withClaims } from '@function-bucket/fnb-db-types'
import { upsertTopic } from '@function-bucket/fnb-db-types/mutations/fnb-msg/upsert-topic'

export default defineEventHandler(async (event) => {
  const { db, claims } = event.context
  if (!claims) throw createError({ statusCode: 401 })

  const body = await readBody<{ name: string }>(event)
  const topic = await withClaims(db, claims, (trx) =>
    upsertTopic(trx, { name: body.name })
  )
  return topic
})
```

### File: `server/api/topics/[id]/messages/index.get.ts`

```typescript
export default defineEventHandler(async (event) => {
  const { db, claims } = event.context
  if (!claims) throw createError({ statusCode: 401 })

  const topicId = getRouterParam(event, 'id')!
  const messages = await withClaims(db, claims, (trx) =>
    msgQueries.selectMessagesByTopicId(trx, topicId)
  )
  return messages
})
```

### File: `server/api/topics/[id]/messages/index.post.ts`

```typescript
export default defineEventHandler(async (event) => {
  const { db, claims } = event.context
  if (!claims) throw createError({ statusCode: 401 })

  const topicId = getRouterParam(event, 'id')!
  const body = await readBody<{ content: string }>(event)
  const message = await withClaims(db, claims, (trx) =>
    upsertMessage(trx, { topicId, content: body.content })
  )
  return message
  // NOTE: inserting a message fires the _500_gql_insert trigger which calls pg_notify
})
```

---

## Phase 6 — Real-Time via WebSocket + `pg_notify`

The trigger is already wired in the DB:

```sql
-- Already deployed in db/fnb-msg/deploy/00000000010410_msg_fn.sql
CREATE OR REPLACE TRIGGER _500_gql_insert
  AFTER INSERT ON msg.message
  FOR EACH ROW
  EXECUTE FUNCTION app_fn.tg__graphql_subscription(
    'create',
    'topic:$1:message',   -- notify channel: 'topic:<topic_id>:message'
    'topic_id'
  );
```

Every INSERT to `msg.message` fires `pg_notify('topic:<topicId>:message', '{"event":"create","subject":"<topicId>","id":"<messageId>"}')`.

### Server-side: Nuxt Nitro WebSocket handler

**File: `server/routes/_ws/topics/[id]/messages.ts`**

```typescript
import { createPool } from 'pg'

export default defineWebSocketHandler({
  async open(peer) {
    const topicId = peer.request?.url ? new URL(peer.request.url).pathname.split('/')[4] : null
    if (!topicId) { peer.close(); return }

    const pool = createPool(process.env.DATABASE_URL!)
    const client = await pool.connect()

    await client.query(`LISTEN "topic:${topicId}:message"`)
    client.on('notification', (msg) => {
      peer.send(msg.payload ?? '')
    })

    peer.ctx = { client, pool }
  },
  close(peer) {
    peer.ctx?.client?.release()
    peer.ctx?.pool?.end()
  }
})
```

### Client-side: composable

**File: `app/composables/useTopicMessages.ts`**

```typescript
export function useTopicMessages(topicId: Ref<string>) {
  const messages = ref<Message[]>([])

  const { data: initial } = await useFetch(() => `/api/topics/${topicId.value}/messages`)
  messages.value = initial.value ?? []

  const ws = useWebSocket(`/_ws/topics/${topicId.value}/messages`, {
    onMessage(_, event) {
      const notification = JSON.parse(event.data)
      if (notification.event === 'create') {
        // Re-fetch or append the new message
        $fetch(`/api/topics/${topicId.value}/messages/${notification.id}`)
          .then((msg) => messages.value.push(msg))
      }
    }
  })

  onUnmounted(() => ws.close())
  return { messages }
}
```

Note: `useWebSocket` is from VueUse (`@vueuse/core`).

---

## Phase 7 — Monorepo Registration

### Add to `apps/msg-app/` turbo tasks (already handled by `turbo.json` glob `apps/*`)

### Add to home-app navigation

The `home-app` dashboard shows available modules based on permissions. Since `install_basic_application` registered `msg-app` with route `/messages`, the module will automatically appear for users with `p:discussions`. No code change needed in `home-app` — the modules list is driven by DB data.

### Add to tenant-layer nav plugin (optional)

If you want the Discussions link in the `tenant-app` sidebar too, add to `packages/tenant-layer/app/plugins/nav-register.ts`:

```typescript
register([
  {
    title: 'Discussions',
    permissionKey: 'p:discussions',
    items: [
      { label: 'Topics', route: 'http://localhost:4002/messages', icon: 'i-lucide-messages-square' }
    ]
  }
])
```

---

## Complete File Checklist

### Database
- [ ] `db/fnb-msg-app/sqitch.conf`
- [ ] `db/fnb-msg-app/sqitch.plan`
- [ ] `db/fnb-msg-app/deploy/00000000010600_msg_app.sql`
- [ ] `db/fnb-msg-app/revert/00000000010600_msg_app.sql`
- [ ] `db/fnb-msg-app/verify/00000000010600_msg_app.sql`

### db-types package
- [ ] Run `pnpm db-generate` → auto-generates `packages/db-types/src/generated/fnb-msg/`
- [ ] `packages/db-types/src/queries/msg.ts`
- [ ] `packages/db-types/src/mutations/fnb-msg/upsert-topic.ts`
- [ ] `packages/db-types/src/mutations/fnb-msg/upsert-message.ts`
- [ ] Update `packages/db-types/src/index.ts` to export new functions

### msg-layer package
- [ ] `packages/msg-layer/package.json`
- [ ] `packages/msg-layer/nuxt.config.ts`
- [ ] `packages/msg-layer/app/plugins/nav-register.ts`

### msg-app
- [ ] `apps/msg-app/package.json`
- [ ] `apps/msg-app/nuxt.config.ts`
- [ ] `apps/msg-app/app/app.vue`
- [ ] `apps/msg-app/app/pages/messages/index.vue`
- [ ] `apps/msg-app/app/pages/messages/[id].vue`
- [ ] `apps/msg-app/app/components/TopicList.vue`
- [ ] `apps/msg-app/app/components/MessageThread.vue`
- [ ] `apps/msg-app/app/components/MessageComposer.vue`
- [ ] `apps/msg-app/app/composables/useTopicMessages.ts`
- [ ] `apps/msg-app/server/middleware/auth.ts`
- [ ] `apps/msg-app/server/plugins/db.ts`
- [ ] `apps/msg-app/server/_common/get-h3-event-claims.ts` (copy from auth-app)
- [ ] `apps/msg-app/server/api/topics/index.get.ts`
- [ ] `apps/msg-app/server/api/topics/index.post.ts`
- [ ] `apps/msg-app/server/api/topics/[id].get.ts`
- [ ] `apps/msg-app/server/api/topics/[id]/messages/index.get.ts`
- [ ] `apps/msg-app/server/api/topics/[id]/messages/index.post.ts`
- [ ] `apps/msg-app/server/routes/_ws/topics/[id]/messages.ts` (real-time)

---

## Summary of the Stack

```
msg.message INSERT
  ↓ (trigger)
pg_notify('topic:<id>:message', payload)
  ↓ (Nitro WebSocket handler)
WebSocket → browser
  ↓ (useTopicMessages composable)
messages.value updated → MessageThread re-renders
```

The complete msg stack follows the exact same pattern as `todo` and `loc`:
- DB tables with parallel `msg_tenant` + `msg_resident` shadow tables
- `ensure_msg_resident()` called lazily on first write
- `msg_api.*` functions check `p:discussions` permission via `auth.enforce_permission`
- `withClaims()` wraps every server-side DB call for RLS enforcement
- `display_name` kept in sync via trigger on `app.profile` update
