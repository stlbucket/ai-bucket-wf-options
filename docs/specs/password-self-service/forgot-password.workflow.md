# Forgot Password — n8n workflow (`n8n/workflows/forgot-password.json`)

## Status
Draft. This is **the second half of `invite-user`** (R22 — n8n is the sole engine). It is
`invite-user.json` with the first two nodes removed (no resident creation, no ZITADEL user
creation) and the Code node reduced to its **409/re-invite branch**: search the ZITADEL user by
email → `password_reset` (return-code) → build the set-password link → hand off to
`send-notification`.

## Shape (3 nodes — vs. invite-user's 4)

```
Webhook (POST /forgot-password, headerAuth: fnb-webhook-secret)
  └─ Resolve Reset Link (Code node)
        └─ Send Email (HTTP Request → http://n8n:5678/webhook/send-notification, fnb-webhook-secret)
```

Dropped vs. `invite-user.json`: the **"Create Resident"** Postgres node and the create-human-user
half of the Code node. Kept verbatim: the PAT read, org resolve, email search, `password_reset`,
the `setPasswordUrl` build, and the `send-notification` HTTP node.

### Node 1 — Webhook
Identical to `invite-user.json`'s Webhook: `httpMethod: POST`, `path: forgot-password`,
`authentication: headerAuth` (credential `fnb-webhook-secret`), `responseMode: onReceived`.
Body: `{ email }` (the admin-reset caller also sends `tenantId`/`profileId` — ignored).

### Node 2 — Resolve Reset Link (Code node, `runOnceForAllItems`)
Lifted from `invite-user.json`'s Code node **409 branch** (`invite-user.json:63`). Pseudocode:

```js
const E = process.env || {}
const zOrigin  = E.NUXT_ZITADEL_INTERNAL_URL || 'http://zitadel:8080'
const zHost    = (E.NUXT_ZITADEL_ISSUER || 'http://localhost:8200').replace(/^https?:\/\//, '')
const authBase = E.NUXT_PUBLIC_AUTH_APP_URL || 'http://localhost:4000/auth'

const email = ($('Webhook').first().json.body.email || '').trim()
if (!email) throw new Error('forgot-password: email is required')

const pat = fs.readFileSync('/zitadel-seed/admin.pat', 'utf8').trim()
// ... same httpReq / zitadel() helpers as invite-user.json ...

// 1. Search the user by email (invite-user.json call 1b)
const search = await zitadel('POST', '/v2/users', {
  queries: [{ emailQuery: { emailAddress: email } }],
})
const userId = search.json?.result?.[0]?.userId

// 2. NO USER → silently no-op. Return [] so no email is sent (anti-enumeration; the route
//    already told the browser "if an account exists…"). Do NOT throw.
if (!userId) return []

// 3. Mint a password-reset code (return-code) — invite-user.json 409 branch
const reset = await zitadel('POST',
  '/v2/users/' + encodeURIComponent(userId) + '/password_reset', { returnCode: {} })
const resetCode = reset.json?.verificationCode
if (!resetCode) throw new Error('forgot-password: password_reset failed (' + reset.status + ')')

// 4. Build the set-password link → the EXISTING /auth/set-password page (unchanged)
const setPasswordUrl = authBase + '/set-password?userId=' + encodeURIComponent(userId)
  + '&code=' + encodeURIComponent(resetCode)

// 5. Emit the exact send-notification payload (set-password template, reused verbatim)
return [{ json: {
  channel: 'email', templateKey: 'set-password', to: email,
  subject: 'Reset your fnb password',
  vars: { displayName: email, setPasswordUrl },
  tenantId: null, profileId: null, userId,
} }]
```

- **No-user → `return []`** (not a throw): the workflow ends with no downstream item, so no email,
  no error, no enumeration signal. This is the one behavioral difference from invite-user's 409
  branch (which always has a user).
- `templateKey: 'set-password'` reuses the template `send-notification`'s Render node already
  carries (added in `user-invitation` Phase 1/2). `subject` overrides to "Reset your fnb password";
  the body/CTA (`setPasswordUrl`) is identical. (Distinct `password-reset` template = optional
  polish, `_shared.data.md` Open Question.)
- `displayName` falls back to the email (forgot-password has no name context; fine for the greeting).

### Node 3 — Send Email (HTTP Request)
Identical to `invite-user.json`'s "Send Email" node: POST `http://n8n:5678/webhook/send-notification`,
`httpHeaderAuth: fnb-webhook-secret`, `jsonBody: {{ JSON.stringify($json) }}`. When node 2 returns
`[]`, this node never runs.

## Settings
- `errorWorkflow`: same shared handler as the other workflows (`invite-user.json:130`).
- Reuses the invite-user credentials (`fnb-webhook-secret`) and the `zitadel-seed` ro volume mount
  — both already present on the n8n service.

## Confirm during authoring (Phase 0/1)
- [ ] PAT read + `password_reset` return-code both already proven live by `invite-user.json` — no
      new ZITADEL surface. Just the node-trim + the `return []` no-op branch.
- [ ] The `set-password` template exists in `send-notification`'s Render node (it does, per
      `user-invitation` Phase 2) — confirm it renders with `displayName = email`.
