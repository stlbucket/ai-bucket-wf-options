# D6 — Bridge Uses Hand-Rolled `channelPeers` Map

## What the Docs Say vs What We Do

The crossws API (`peer.subscribe(channel)` / `nitro.h3App.websocket?.publish(channel, data)`)
is the documented pattern for pub/sub in Nitro WebSocket handlers.

**We do not use this pattern.** The production implementation in `packages/msg-layer/server/plugins/pg-notify-bridge.ts` maintains its own peer registry.

## Why

The crossws `publish` API had reliability issues during development — messages were dropped or
delivered to the wrong peers in certain conditions. The hand-rolled Map gives explicit, auditable
control over exactly which peers receive which messages.

## The Actual Implementation

```typescript
const refCounts = new Map<string, number>()       // channel → subscriber count
const channelPeers = new Map<string, Set<any>>()  // channel → set of peer objects

client.on('notification', (msg) => {
  if (!msg.channel || !msg.payload) return
  const peers = channelPeers.get(msg.channel)
  if (!peers) return
  for (const peer of peers) {
    try {
      peer.send(msg.payload)
    } catch {
      peers.delete(peer)  // clean up dead peers silently
    }
  }
})

nitro.pgBridge = {
  async subscribe(channel, peer) {
    const count = refCounts.get(channel) ?? 0
    if (count === 0) await client.query(`LISTEN "${channel}"`)
    refCounts.set(channel, count + 1)

    // Replace peer if reconnected (same peer.id, new object)
    if (!channelPeers.has(channel)) channelPeers.set(channel, new Set())
    const peerSet = channelPeers.get(channel)!
    for (const p of peerSet) {
      if (p.id === peer.id) { peerSet.delete(p); break }
    }
    peerSet.add(peer)
  },

  async unsubscribe(channel, peer) {
    const count = (refCounts.get(channel) ?? 1) - 1
    channelPeers.get(channel)?.delete(peer)
    if (channelPeers.get(channel)?.size === 0) channelPeers.delete(channel)
    if (count <= 0) {
      refCounts.delete(channel)
      await client.query(`UNLISTEN "${channel}"`)
    } else {
      refCounts.set(channel, count)
    }
  },
}
```

## Ref-Count Logic

`refCounts` tracks how many peers are subscribed to each channel. `LISTEN` fires only on the
first subscriber; `UNLISTEN` fires only when the last subscriber leaves. This avoids redundant
LISTEN/UNLISTEN round-trips for channels with multiple active watchers.

## Reconnect Handling

The `subscribe` function checks for an existing peer with the same `peer.id` and removes the
old entry before adding the new one. This handles browser reconnects cleanly — the old peer
object becomes a zombie and is replaced.
