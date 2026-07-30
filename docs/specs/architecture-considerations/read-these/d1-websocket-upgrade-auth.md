# D1 — WebSocket Upgrade Auth: `upgrade()` Hook Semantics

## How `defineWebSocketHandler` Works

Nitro's `defineWebSocketHandler` has four hooks: `upgrade`, `open`, `close`, `message`.

```typescript
export default defineWebSocketHandler({
  async upgrade(request) {
    // Runs BEFORE the WebSocket handshake completes
    // Throw a Response to reject — sends HTTP error, no half-open WS connection
    const { claims } = await getWsUpgradeClaims(request.headers, useNitroApp().db)
    if (!claims) throw new Response('Unauthorized', { status: 401 })

    // Return context to pass to open/close/message
    return { context: { claims } }
  },

  async open(peer) {
    // Runs AFTER handshake — connection is established
    // peer.context contains what upgrade() returned
    const { claims } = peer.context
    const topicId = new URL(peer.request!.url, 'http://x').pathname.split('/')[4]
    await useNitroApp().pgBridge.subscribe(`topic:${topicId}:message`, peer)
  },

  async close(peer) {
    const topicId = new URL(peer.request!.url, 'http://x').pathname.split('/')[4]
    await useNitroApp().pgBridge.unsubscribe(`topic:${topicId}:message`, peer)
  },

  error(peer, error) {
    console.error('[ws] error', peer.id, error)
  }
})
```

## Key Points

**`upgrade` vs `open`:** `upgrade` fires during the HTTP→WS upgrade handshake, before the
connection is established. Throwing here sends a normal HTTP error response (e.g. 401) and
closes the connection cleanly — no half-open WebSocket. `open` fires after the handshake
succeeds and cannot reject the connection.

**Always authenticate in `upgrade`, never in `open`.** Authenticating in `open` means the
connection is already established when you decide to reject — you'd have to call `peer.close()`
which is less clean and the client sees a connected-then-closed sequence.

**`peer.context`** set in `upgrade` is available in all subsequent hooks (`open`, `close`,
`message`). Use it to pass claims, topic IDs, or any per-connection state.

## Why `getWsUpgradeClaims` Instead of `getEventClaims`

WebSocket upgrade requests are not H3 events — they are raw `Request` objects. Cookies must
be parsed manually from the `Cookie` header. `getWsUpgradeClaims` in
`server/utils/getWsUpgradeClaims.ts` does this parsing and then calls `profileClaimsForUser`
the same way the HTTP middleware does.
