> **Execution Directive:** execute this plan via `/fnb-stack-implementor <this-file>`. It was
> derived from `docs/specs/graphql-api-app/README.md` (Phase 1) — the spec's Error-surfacing
> contract is the authority; this file is the sequenced build order.

# Surface GraphQL errors (replace default maskError)

**Severity:** HI — production bugs are currently unreportable from the client: every PL/pgSQL
`raise exception` from `<module>_api` reaches the client as
`An error occurred (logged with hash: '…', id: '…')` with `extensions` wiped.

## Context

grafserv's `defaultMaskError` passes through only pure `GraphQLError`s and grafast `SafeError`s;
everything else is hash-masked and the real message goes only to the server console. The
`triggerWorkflow` plugin already works around this locally with `SafeError`
(`apps/graphql-api-app/server/graphile/trigger-workflow.plugin.ts:93-97`), but DB-raised errors
(permission denials, validation failures) are still masked.

**Spec authority (read before executing):**

- `docs/specs/graphql-api-app/server-pattern.md` → "Error surfacing (`maskError`)" — the full
  contract **including the verified code snippet and import paths**
- `docs/specs/graphql-api-pattern.md` → Error Handling → "Error surfacing (`maskError`)" — the
  client-facing contract
- `docs/specs/graphql-api-app/README.md` → Locked decisions (default-on surfacing;
  `GRAPHQL_MASK_ERRORS=true` escape hatch; pg `errcode`/`detail`/`hint` in `extensions`; never
  stack traces; accepted schema-internals-leak risk)

## Tasks

### 1. Implement the custom `maskError`

- [ ] In `apps/graphql-api-app/server/graphile.config.ts`: add the `maskError` function at module
      scope and reference it from the `grafserv` block (currently `graphile.config.ts:56-61`).
      Use the snippet in `server-pattern.md` → Error surfacing verbatim — imports are
      pre-verified against the installed packages (`defaultMaskError` from
      `postgraphile/grafserv`, `isSafeError` from `postgraphile/grafast`, `GraphQLError` from
      `postgraphile/graphql`; strict pnpm — bare `grafserv`/`grafast` are not app deps).
- [ ] No other file changes: no new deps (all imports are `postgraphile` sub-paths, already a
      dependency), no compose/env change (`GRAPHQL_MASK_ERRORS` is optional and unset by design).

### 2. Build gate

- [ ] `pnpm build` passes (repo root — the gate; repo-wide `pnpm lint` is known-broken).

### 3. Verify against the running dev env (read-only; never restart the env yourself)

- [ ] If the running graphql-api-app doesn't pick up the config change via dev hot-reload, stop
      and ask the user to restart it (house rule: never rebuild/restart the env yourself).
- [ ] Fire a mutation that raises in `<module>_api` (e.g. one gated by a permission the caller
      lacks — expect `30000: NOT AUTHORIZED`) and confirm the raised message and
      `extensions.errcode` appear in the GraphQL error response instead of the hash.
- [ ] Confirm a `SafeError` path still passes through unchanged (e.g. `triggerWorkflow` with an
      unknown key → `unknown workflow: <key>`).
- [ ] With `GRAPHQL_MASK_ERRORS=true` set on the server process, confirm the hash behavior
      returns (this needs an env change + restart — coordinate with the user; acceptable to
      defer this check to the user's next restart if they prefer).

### 4. Close the spec/rules loop (R21)

- [ ] `docs/specs/graphql-api-app/server-pattern.md` — flip the Error-surfacing section (and the
      Status-line exception note) from Draft to Implemented.
- [ ] `docs/specs/graphql-api-pattern.md` → Error Handling — flip the mirror section from Draft
      to Implemented.
- [ ] `docs/specs/graphql-api-app/README.md` — check off Phase 1 tasks; Status → Implemented.
- [ ] `docs/specs/global-rules.md` → Known Gaps — update the "Error handling strategy for
      `<module>_api` permission failures surfaced through GraphQL" line: the transport now
      surfaces real messages + pg fields (point at `graphql-api-pattern.md` → Error surfacing);
      the remaining gap is a client-side error taxonomy (typed mapping of `errcode`/messages to
      UI errors instead of string matching).

## Out of scope

- Client error taxonomy / typed error mapping (stays a Known Gap).
- Any change to `SafeError` usage in existing plugins.
- Sentry capture of unmasked errors (sentry.server.config.ts) — unchanged behavior.
