# D5 — Why One Dedicated `pg.Client` (Not Pool) for the Bridge

## The Problem with a Connection Pool

PostgreSQL's `LISTEN` command registers interest on a specific connection. If you use a pool:

1. `pool.query('LISTEN "topic:abc:message"')` — the LISTEN is registered on whichever
   connection the pool picks at that moment
2. Next query from the pool may use a different connection — one that has never LISTENed
3. Notifications on `topic:abc:message` arrive on the first connection, but it may be
   returned to the pool and reassigned
4. Result: notifications are received inconsistently or not at all

## The Solution: Dedicated `pg.Client`

A single `pg.Client` (not pool) is created at Nitro startup, connects once, and holds open
for the lifetime of the process:

```typescript
// packages/msg-layer/server/plugins/pg-notify-bridge.ts
const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()

// All LISTEN/UNLISTEN operations on this one client
await client.query(`LISTEN "${channel}"`)
await client.query(`UNLISTEN "${channel}"`)

// All notifications come through this one client
client.on('notification', (msg) => { /* fan out to peers */ })

nitro.hooks.hookOnce('close', () => client.end())
```

## Why This Works

- One connection = consistent notification delivery
- PostgreSQL supports unlimited LISTEN channels per connection — no scaling issue
- Zero per-peer overhead — the bridge client handles all topics regardless of how many peers
- The bridge client never runs business queries; it is dedicated to LISTEN/NOTIFY only

## Coexistence with the app's other DB connections

The bridge client is separate from every other DB connection in the system (there is no more
Kysely `event.context.db`):
- App data access: the default path is PostGraphile's own pool (GraphQL); `db-access` owns a raw
  `pg.Pool` for the pre-claims trio + `withClaims` reads — multiple connections, normal lifecycle
- Bridge client: a single dedicated `pg.Client` connection, only for LISTEN/NOTIFY

All target the same PostgreSQL database. They coexist without conflict.
