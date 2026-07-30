# Actions — Customizing ZITADEL Behavior

Two generations coexist; v2 executions run **in addition to** v1 actions until v1 is removed. Prefer v2 for new work.

## Actions v1 (in-process JavaScript)

An action = name + JS snippet + timeout (seconds) + "allowed to fail" switch (if off, a failing action fails the whole flow). Actions are attached to **flows** at **trigger points**:

- **External Authentication** flow — e.g. post-auth of a federated login: map ADFS/AzureAD groups to ZITADEL roles, set metadata, block registrations by email domain.
- **Internal Authentication** flow — same idea for native logins (pre/post creation, post authentication).
- **Complement Token** flow — *pre access token / pre userinfo creation*: add custom claims, e.g. `api.v1.claims.setClaim('groups', [...])` style additions.
- **Customize SAML Response** — modify SAML attributes.

`console.log` output from an action lands in the token claim `urn:zitadel:iam:action:{actionname}:log`. Scripts run inside ZITADEL with a restricted runtime (limited fetch, no arbitrary modules).

Typical uses: assign roles from IdP groups, custom pre-creation validation, stamping user metadata, restricting registration to allowed domains.

## Actions v2 (HTTP targets + executions)

Moves custom logic **out of process**: ZITADEL calls *your* endpoint.

Three pieces:
1. **Endpoint** — any HTTPS service accepting an HTTP POST (your code, any language).
2. **Target** — ZITADEL resource describing how to call it. Types: **webhook** (fire-and-forget-ish, response ignored), **call** (request/response — the response can *modify* the payload, e.g. manipulate a request or token), **async** (event delivery, no waiting). Configurable timeout and interrupt-on-error.
3. **Execution** — binds targets to a **condition**:
   - **Request** — before an API request is processed (intercept/augment, e.g. on `/zitadel.user.v2.UserService/AddHumanUser`)
   - **Response** — after, before returning to caller
   - **Function** — replaces the v1 flow hooks (complement token etc.)
   - **Event** — react to eventstore events (e.g. user locked)

Conditions can match a specific method, a whole service, or all. Manage via the Action v2 API (`/v2` actions endpoints / `zitadel.action.v2.*`) or Console. Payloads are signed (signing key on the target) — verify signatures in your endpoint. To disable v2 behavior, remove the Executions (targets alone do nothing).

Examples repo: https://github.com/zitadel/actions — current reference: https://zitadel.com/docs/apis/actions/v3-api (naming has shifted between "v2"/"v3" across releases; check the running version's docs).

## Choosing

- Add a claim / tweak token for an existing tenant quickly → v1 Complement Token still works and is simple.
- Anything new, anything needing real dependencies/secrets/observability, request interception, or event reactions → v2 targets + executions.
