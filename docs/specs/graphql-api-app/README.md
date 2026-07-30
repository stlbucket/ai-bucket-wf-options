> **Execution Directive:** plan + build this spec via `/fnb-stack-implementor <this-README>` —
> the implementor derives the `docs/issues/` plan file (R23) from the task list below,
> then executes it.

# graphql-api-app — spec index

## Status

Implemented — including the error-surfacing `maskError` contract (`server-pattern.md` → Error
surfacing), built and verified 2026-07-30 (plan: `docs/issues/` →
`0100__graphql___surface-graphql-errors`).

## Purpose

`apps/graphql-api-app` is the data-stack hub: PostGraphile 5 mounted on Nitro/h3, exposing the
GraphQL API for every module schema, with auth via the tenant-layer middleware → `grafast.context`
→ `pgSettings` → RLS. These specs record how it is wired and the contracts other layers depend on.

**Current work item — surface GraphQL errors (2026-07-30).** grafserv's default `maskError` hides
every non-`SafeError` error — including every PL/pgSQL `raise exception` from `<module>_api` —
behind `An error occurred (logged with hash: '…', id: '…')` with `extensions` wiped. That makes
production bugs unreportable from the client side. The contract: a custom `grafserv.maskError`
that preserves the real message and pg fields (`errcode`, `detail`, `hint`), never the stack, with
an env escape hatch to restore stock masking.

## Locked decisions

| Decision | Why |
|---|---|
| Surface real error messages by **default** (no env var needed) | The whole point is production debuggability *now*; requiring a var to be set in prod would add a deploy-config step for the common case |
| Escape hatch `GRAPHQL_MASK_ERRORS=true` restores stock masking | "At least for now" (user, 2026-07-30) — when the debugging phase ends, masking comes back via config, not a code change |
| Expose pg `errcode`/`detail`/`hint` in `extensions`; **never** stack traces | Message alone often lacks the constraint/hint context; stacks leak server internals with no client value |
| Accepted risk: raw pg messages can leak schema internals (table/constraint names) to clients | Deliberate, recorded trade-off for the debugging phase; the escape hatch is the revert path |
| Custom `maskError` in `graphile.config.ts`, not v4 `extendedErrors` | Keeps the default's `SafeError`/`GraphQLError` pass-throughs explicit and the whole policy in one readable function (see Considered & rejected) |

## Files in this spec

| File | Covers |
|---|---|
| `_overview.md` | Full app architecture — Nuxt config, deps, plugins, middleware, layer wiring |
| `server-pattern.md` | PostGraphile 5 on Nitro/h3 — `graphile.config.ts`, pgl/serv, extendSchema plugins, auth, WS; **includes the Draft Error-surfacing contract** |
| `graphql-client-api-package.md` | The client package — codegen, `.graphql` layout, hooks, composable re-export |
| `worker-pattern.md` | TOMBSTONE — graphile-worker/wf retired; n8n is the engine (R22) |

## Implementation Task List

### Phase 1 — surface errors through GraphQL (done 2026-07-30)

- [x] Add the custom `maskError` to `apps/graphql-api-app/server/graphile.config.ts` and reference
      it from the `grafserv` block — exactly per `server-pattern.md` → Error surfacing (imports
      verified there against installed packages)
- [x] `pnpm build` passes (the repo gate)
- [x] Verify in dev: anon `createTenant` returned the real raise (`new row violates row-level
      security policy for table "tenant"`, `extensions.errcode: 42501`) instead of the hash;
      `SafeError` pass-through re-confirmed (`triggerWorkflow` → `401: not authenticated`).
      *Deferred:* the `GRAPHQL_MASK_ERRORS=true` restore check (needs an env change + restart —
      run at the next convenient restart)
- [x] Flip the Error-surfacing section in `server-pattern.md` (and the mirror section in
      `../graphql-api-pattern.md` → Error Handling) from Draft to Implemented; `global-rules.md`
      Known Gaps line narrowed to the remaining client-side error taxonomy

## Remaining Open Questions

- None for Phase 1. (Future, out of scope: a proper client error taxonomy — mapping
  `errcode`/message conventions to typed UI errors — would replace today's string matching.)

## Considered & rejected

- **`makeV4Preset({ extendedErrors: [...] })` / `showErrorStack`** — the v4 compat preset can
  generate a `maskError` that exposes pg fields, but it bypasses the default's `SafeError`
  handling semantics and hides the policy inside preset options; a small explicit function is
  clearer and env-gatable.
- **Leaving masking on and reading errors from server logs** — the hash + server-console log is
  exactly the current state; it makes the user round-trip through container logs for every
  production bug report, which is what this spec removes.
- **Unmasking only behind an env var (masked by default)** — inverts the "for now" posture and
  adds a required prod deploy-config change; rejected in favor of default-on with a masking
  escape hatch.
