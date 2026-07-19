---
name: project-msg-stack
description: fnb-msg full stack status — architecture, what's built, what's fixed, what's pending
metadata:
  type: project
---

## Architecture (current state, `msg` branch)

All msg server-side code lives in **msg-layer** (inherited by msg-app). tenant-app is UI-only for msg.

**nginx routing (docker/nginx.conf)** — does NOT strip prefix:
- `/msg` → `http://msg-app:3000` (passes full `/msg/...` path through)
- `/tenant` → `http://tenant-app:3000`

**FIXED**: The old separate `/msg/_ws/` location (which stripped the `/msg` prefix) was removed. `/msg` now handles all msg-app traffic including WebSocket upgrades.

**msg-app** has `NUXT_APP_BASE_URL=/msg`, so Nitro registers ALL routes (API and WS) under `/msg/`:
- `/msg/api/topics` → `server/api/topics/index.get.ts`
- `/msg/_ws/topics/[id]/messages` → `server/routes/_ws/topics/[id]/messages.ts`

---

## What's in msg-layer (`packages/msg-layer/`)

- `nuxt.config.ts` — extends auth-layer, `nitro.experimental.websocket: true`
- `server/plugins/pg-notify-bridge.ts` — PostgreSQL LISTEN/NOTIFY bridge; ref-counted channels; uses **direct `peer.send()`** (NOT h3 publish — h3 1.15.11 has no publish method)
- `server/routes/_ws/topics/[id]/messages.ts` — WebSocket handler; calls `pgBridge.subscribe/unsubscribe`
- `server/api/topics/index.get.ts` — `selectMySubscribedTopics` (uses residentId)
- `server/api/topics/index.post.ts` — create topic + subscribers + initial message
- `server/api/topics/[id].get.ts` — get single topic
- `server/api/topics/[id]/messages/index.get.ts` — `selectRecentMessagesByTopicId`
- `server/api/topics/[id]/messages/index.post.ts` — post message
- `server/api/topics/[id]/messages/[msgId].get.ts` — `selectMessageWithSenderById`
- `server/api/residents.get.ts` — `selectResidentsByTenantId`

**Important:** h3 1.15.11 is pinned in root package.json pnpm overrides. Always use direct peer registry approach.

---

## What's in tenant-app (UI only)

- `app/pages/msg/index.vue` — topic list + "New Conversation" modal
- `app/pages/msg/[id].vue` — single topic view
- `app/components/Msg.vue` — message thread + WS connection + send box
- `app/components/MsgTopicList.vue` — topic list component
- `server/api/residents.get.ts` — duplicated here for SSR (tenant-app's Nitro can't reach msg-app during SSR)

---

## Cross-app fetch pattern (critical)

**Problem:** tenant-app has `NUXT_APP_BASE_URL=/tenant`. Both SSR `useFetch` and client `$fetch` with relative paths fail for cross-app calls:
- SSR `useFetch('/msg/api/...')` → Nitro local fetch → tenant-app Nitro → 404 (no such route)
- Client `$fetch('/msg/api/...')` → Nuxt applies baseURL → `/tenant/msg/api/...` → nginx → tenant-app → 404

**Fix:** `msgAppInternalUrl` (private, server) + `public.msgAppUrl` (public, client) in `apps/tenant-app/nuxt.config.ts`:

```typescript
runtimeConfig: {
  msgAppInternalUrl: 'http://msg-app:3000/msg',
  public: {
    msgAppUrl: 'http://localhost:4000/msg'
  }
}
```

Usage pattern in pages/components:
```typescript
const config = useRuntimeConfig()
const msgApiBase = import.meta.server
  ? `${config.msgAppInternalUrl}/api`
  : `${config.public.msgAppUrl}/api`
```

WebSocket URL in Msg.vue uses `location.host` directly (client-only, bypasses baseURL issue).

---

## DB types status

`packages/db-types/src/generated/fnb-msg/` types are **hand-written** (schema not yet deployed to dev DB).

To deploy: `DEPLOY_PACKAGES="fnb-auth fnb-app fnb-msg"` in docker-compose db-migrate, then run `pnpm db-generate`.

---

## WS propagation loop (full flow)

1. Client: `$fetch POST .../topics/${id}/messages` (`Msg.vue` `send()`)
2. `msg-layer/server/api/topics/[id]/messages/index.post.ts` → `withClaims → msgApi.upsertMessage`
3. DB `msg_fn.upsert_message` → inserts row → `pg_notify('topic:<id>:message', {event,id})` on commit
4. `pg-notify-bridge.ts` `client.on('notification')` → `peer.send(payload)` to all subscribed peers
5. Client `ws.addEventListener('message')` → parses `{event:'create', id}` → fetches full message
6. Message appended to `messages.value`

WS subscription: `open` handler calls `pgBridge.subscribe('topic:<id>:message', peer)`.

---

## Current debug log state

Debug console.logs are currently added to (committed on `msg` branch):
- `packages/msg-layer/server/routes/_ws/topics/[id]/messages.ts` — logs upgrade (with db/claims status), open (with topicId), close, subscribe
- `packages/msg-layer/server/plugins/pg-notify-bridge.ts` — logs pg notifications, peer count, peer sends
- `apps/tenant-app/app/components/Msg.vue` — logs ws open, error, message received, close

---

## Pending: verify after environment rebuild

After rebuild, open a topic page and check:
1. Browser console: `[Msg] connect() called` → `[Msg] ws url: ws://...` → `[Msg] ws open`
2. msg-app Docker logs: `[ws] upgrade — db available: true` → `[ws] upgrade — claims: <email>` → `[ws] open — topicId: <id>` → `[bridge] subscribe — channel: topic:<id>:message`
3. Post a message → msg-app logs: `[bridge] pg notification — channel: topic:<id>:message` → `[bridge] peers on channel: 1` → `[bridge] sending to peer: <id>`
4. Browser console: `[Msg] ws message received: {event:'create', id:'...'}`

If step 2 shows `db available: false`, the `'request'` hook in `db.ts` isn't firing for WS upgrade events — fix by initializing db via `nitro.hooks.hook('upgrade', ...)` or passing db via a different mechanism.
