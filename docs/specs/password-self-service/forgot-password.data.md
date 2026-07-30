# Forgot Password (Data) — auth-app route + workflow trigger

## Status
Draft. One **unauthenticated** H3 route in auth-app that fires the n8n `forgot-password` workflow
server-to-server. No fnb GraphQL/RLS surface (the caller has no session). Legitimate REST/H3
carve-out, same shape as the onboard `request-password` route's call to `send-notification`.

## Route: `POST /auth/api/forgot-password`
File: `apps/auth-app/server/api/forgot-password.post.ts`

```ts
// body: { email: string }
```
1. Validate `email` present + basic format (reject empty/malformed → `400`; do **not** reveal
   anything about account existence).
2. POST the internal n8n webhook — the same server-to-server shape the onboard `request-password`
   route uses (`verify-email.data.md`):
   ```
   POST ${N8N_INTERNAL_URL}/webhook/forgot-password
   headers: { 'content-type': 'application/json', 'x-fnb-webhook-secret': N8N_WEBHOOK_SECRET }
   body:    { "email": "<email>" }
   ```
   The webhook responds immediately (`onReceived`) — fire-and-forget.
3. **Always respond `200 { ok: true }`** when the email was well-formed — regardless of whether a
   ZITADEL user exists. The workflow decides silently whether to send. This is the anti-enumeration
   contract; the page shows the same "if an account exists…" message either way.
4. If the **webhook POST itself** fails (n8n down / non-2xx) → `502`. (A transport failure is not an
   enumeration signal — it is the same for every email.)

### Why not `triggerWorkflow`?
`triggerWorkflow` is the **claims-gated** GraphQL mutation (401 without a session). Forgot-password
is by definition pre-login — there are no claims. So this route holds the shared secret
server-side and POSTs the webhook directly, exactly as `request-password` POSTs `send-notification`.
The webhook's own `fnb-webhook-secret` header-auth is the trust boundary; the browser never sees it.

## Anti-abuse (Phase 2)
- Unauthenticated + emails a reset code by address → **rate-limit by IP + email** (e.g. N/hour).
- The always-200 response already denies the enumeration oracle; rate-limiting denies the spam/DoS
  and the reset-code-flooding vectors. Pair with the same limiter the onboard routes get.

## Errors → page states
| Condition | Response | Page |
|---|---|---|
| accepted (well-formed email) | `200` | `sent` (generic) |
| malformed/empty email | `400` | inline field error |
| n8n webhook unreachable / non-2xx | `502` | error toast |

## The two callers of the `forgot-password` webhook
Both POST `{ email }` to `/webhook/forgot-password` with `x-fnb-webhook-secret`; the workflow only
reads `body.email`:
1. **This route** — unauthenticated, home-page origin.
2. **Admin reset** — authenticated `triggerWorkflow('forgot-password', { email })` (see
   `admin-reset.data.md`). `triggerWorkflow` also appends `tenantId`/`profileId`; the workflow
   ignores them.

## Open Questions
- [ ] Rate-limit strategy (shared with onboard routes) — Phase 2.
