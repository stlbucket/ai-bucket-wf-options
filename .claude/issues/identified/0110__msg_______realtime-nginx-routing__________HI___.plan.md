# Plan: msg realtime paths (`/_ws/...`, `/api/topics/...`) have no nginx route — likely broken

> **Execution Directive:** Implement via the `fnb-stack-implementor` skill. **Verify at runtime FIRST**
> (this may already work via a mechanism the static audit missed) before changing nginx.
> Invoke: `/fnb-stack-implementor .claude/issues/identified/msg-realtime-nginx-routing.plan.md`
> Never run `git`; never rebuild Docker yourself — ask the user, then verify read-only.

**Severity: HIGH if confirmed broken; UNVERIFIED** · Workstream: WS3 (app auth) · Identified: 2026-07-05

## Details

The msg-app real-time client uses **absolute** paths with no `/msg` prefix:

- `apps/msg-app/app/composables/useTopicMessages.ts:44` —
  `new WebSocket(\`${protocol}//${location.host}/_ws/topics/${id}/messages\`)`
- `apps/msg-app/app/composables/useTopicMessages.ts:49` —
  `$fetch(\`/api/topics/${id}/messages/${notification.id}\`)`

The handlers live in the msg-layer server dir:
- `packages/msg-layer/server/routes/_ws/topics/[id]/messages.ts` (WS handler)
- `packages/msg-layer/server/api/topics/[id]/messages/[msgId].get.ts` (incremental read, `withClaims`)

But `docker/nginx.conf` has location blocks only for `/auth`, `/tenant`, `/msg`, `/graphql-api`
(+ `/graphql-api/api/graphql/stream`, `/ruru-static`) and a catch-all `/` → home-app. There is **no
`location /_ws` and no `location /api/topics`**. Those absolute paths therefore fall through to `/`
→ home-app, which extends `tenant-layer` (not `msg-layer`) and does not have the WS/message
handlers. Also, `$fetch('/api/topics/...')` from the msg-app has no try/catch
(`useTopicMessages.ts:49`), so a routing failure rejects unhandled inside the WS message listener.

**This is flagged UNVERIFIED**: WebSocket upgrade routing and Nitro's dev proxy can behave in ways
static reading doesn't capture, and the msg-app runs under `/msg`. Runtime confirmation is step 1.

## Implication

If confirmed: real-time message delivery is broken — new messages either never arrive (WS never
connects to a handler) or the incremental fetch 404s against home-app. The feature would appear to
work on initial GraphQL load (topic + message list are GraphQL) but silently fail to stream updates.

## Suggested fix

1. **Verify first** (read-only, user starts stack): open a topic in two browser tabs, post a
   message, watch whether the second tab updates; check the Network tab for the `/_ws/...` upgrade
   (101 vs 404/looped) and the `/api/topics/...` fetch status; check dozzle for which app handled them.
2. If broken, the cleanest fix depends on the intended URL contract:
   - **Option A (prefix the client paths):** change the client to `/msg/_ws/topics/...` and
     `/msg/api/topics/...` so they route to msg-app via the existing `/msg` block. Must account for
     `NUXT_APP_BASE_URL=/msg` (the router base) so the paths resolve correctly.
   - **Option B (add nginx locations):** add `location /_ws/` and `location /api/topics/` blocks
     proxying to the msg-app upstream, with WebSocket upgrade headers
     (`proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";`) on the `/_ws`
     block. Confirm no collision with other apps' `/api/*` routes (graphql-api-app owns
     `/graphql-api/api/*`, which is already prefixed, so `/api/topics` is currently unclaimed).
   - Prefer Option A — it keeps all msg traffic under the one `/msg` prefix the app already declares,
     consistent with the path-based-proxy design in `.claude/specs/monorepo-bootstrap-pattern.md`.
3. Add try/catch around the incremental `$fetch` (`useTopicMessages.ts:49`) so a transient failure
   doesn't throw inside the WS listener.
4. Update `.claude/specs/sockets-pattern.md` + `monorepo-bootstrap-pattern.md` (nginx routing) with
   the final realtime URL contract (R21).

## Verification

- Two-tab live message test passes: posting in one tab appears in the other in real time.
- Network tab shows the WS upgrade returning 101 and the incremental fetch returning 200 from msg-app.
- `pnpm build` green; user restarts stack; all verification read-only.
