# D3 — WebSocket Horizontal Scaling Caveat

## The Current Architecture (Single Instance)

The `pg-notify-bridge` plugin maintains:
- One `pg.Client` per Nitro instance, connected to PostgreSQL
- One `channelPeers: Map<string, Set<peer>>` in memory per Nitro instance
- Peers subscribe/unsubscribe to channels within that instance's memory

PostgreSQL NOTIFY delivers to the bridge's client. The bridge fans out to all peers in its
in-memory Map. This works perfectly with a single Nitro instance.

## The Multi-Instance Problem

In a horizontally scaled deployment (multiple Nitro instances behind a load balancer):

```
User A's browser → nginx → Nitro instance 1 (WS peer registered here)
User B's browser → nginx → Nitro instance 2

User B posts a message → INSERT → pg_notify fires
→ Nitro instance 1 receives notification, fans out to User A ✓
→ Nitro instance 2 receives notification, but User A's peer is NOT in instance 2's Map ✗
```

Each instance only knows about the peers connected to it. Messages only reach peers on the
same instance as the sender's HTTP request.

## Solutions

**Option 1: Sticky sessions (simpler)**
Configure nginx/load balancer to route a given user's requests (both HTTP and WS) to the same
instance. WS connections stay on one instance; HTTP POSTs that trigger notifies go to the same
instance. No code changes needed.

**Option 2: Redis adapter for crossws (more robust)**
Replace the in-memory peer Map with a Redis pub/sub adapter. Every instance publishes to Redis
on notification; Redis delivers to all instances; each instance fans out to its local peers.
Requires adding a Redis dependency and configuring the crossws adapter.

## Current Status

The current implementation is single-instance and appropriate for the current deployment scale.
No changes needed until horizontal scaling becomes a requirement.
