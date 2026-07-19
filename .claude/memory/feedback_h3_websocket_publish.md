---
name: feedback-h3-websocket-publish
description: h3 1.15.11 has no websocket publish method — use direct peer registry instead
metadata:
  type: feedback
---

Do NOT use `nitro.h3App.websocket?.publish?.()` for broadcasting WebSocket messages.

**Why:** h3 1.15.11 is pinned in the root package.json pnpm overrides. In this version, `h3App.websocket` is a WSHooks object only — it has no `publish` method. Optional chaining prevents errors but messages are silently dropped.

**How to apply:** Always use a direct peer registry (`Map<string, Set<peer>>`) in the Nitro plugin, and call `peer.send(payload)` directly. The pg-notify-bridge plugin in msg-layer already implements this correctly — use it as the reference.
