# Key File Paths — quick reference

| Thing | Path |
|-------|------|
| Login (OIDC redirect + callback) | `apps/auth-app/server/api/auth/oidc/{login,callback,logout}.get.ts` |
| Claims bootstrap (server) | `packages/auth-layer/server/utils/getEventClaims.ts` → `currentProfileClaims` |
| Apply claims to request | `packages/auth-layer/server/utils/applyEventClaims.ts` |
| Auth middleware (tenant apps) | `packages/tenant-layer/server/middleware/auth.ts` |
| `withClaims` (2-arg) | `packages/db-access/src/with-claims.ts` |
| Pre-claims fns | `packages/db-access/src/mutations/{provision-idp-user,create-session,claims-for-session,revoke-session,current-profile-claims,profile-claims-for-user,initialize-anchor,request-otp-login,verify-otp-login}.ts` + `src/queries/{anchor-exists,get-deep-link,session-info}.ts` |
| Session table + fns (0185/0180) | `db/fnb-app/deploy/00000000010290_session.sql` (`auth.session`, `app_fn.claims_for_session`, `app_api.revoke_my_sessions`) |
| Shared types (fnb-types) | `packages/fnb-types/src/*.ts` (barrel `src/index.ts`) |
| ProfileClaims type | `packages/fnb-types/src/profile-claims.ts` |
| Entity mappers | `packages/graphql-client-api/src/mappers/<entity>.ts` (`to<Entity>(fragment)`) |
| db-access barrel | `packages/db-access/src/index.ts` |
| graphql codegen config | `packages/graphql-client-api/codegen.ts` |
| generated GraphQL hooks | `packages/graphql-client-api/src/generated/fnb-graphql-api.ts` |
| graphql composables | `packages/graphql-client-api/src/composables/` |
| graphql-client-api barrel | `packages/graphql-client-api/src/index.ts` |
| PostGraphile preset + grafast context | `apps/graphql-api-app/server/graphile.config.ts` |
| grafserv H3 singleton | `apps/graphql-api-app/server/graphserv/serv.ts` |
| GraphQL endpoint | `apps/graphql-api-app/server/api/graphql.ts` |
| useAuth (claims in localStorage) | `packages/auth-ui/src/use-auth.ts` |
| fetch claims via GraphQL | `packages/graphql-client-api/src/composables/useProfileClaims.ts` |
| useAppNav (renders nav from claims `modules`) | `packages/tenant-layer/app/composables/useAppNav.ts` |
| Nav source of truth (module/tool rows, R14) | `db/fnb-app/deploy/00000000010240_app_fn.sql` (`install_application`) |
| Core DB schema | `db/fnb-app/deploy/00000000010220_app.sql` |
| RLS policies | `db/fnb-app/deploy/00000000010250_app_policies.sql` |
| JWT schema | `db/fnb-auth/deploy/00000000010150_jwt.sql` |
| Claims assembly | `db/fnb-app/deploy/00000000010240_app_fn.sql` |
| Support mode SQL | `db/fnb-app/deploy/00000000010243_app_fn_support.sql` |
| becomeSupport / exitSupport (GraphQL) | `packages/graphql-client-api/src/graphql/app/mutation/{becomeSupport,exitSupportMode}.graphql` |
| Sealed session utils (0010) | `packages/auth-layer/server/utils/session.ts` |
| Auth cookie cleanup | `packages/auth-layer/server/utils/auth-cookies.ts` (`deleteAuthCookies`) |
| OIDC login/callback (ZITADEL) | `apps/auth-app/server/api/auth/oidc/{login,callback,logout}.get.ts` + `server/utils/oidc.ts` |
| WS message read (withClaims carve-out) | `packages/msg-layer/server/api/topics/[id]/messages/[msgId].get.ts` |
| Upload endpoint (withClaims carve-out) | `packages/storage-layer/server/api/upload.post.ts` |
| workflow engine (n8n) | `n8n/workflows/*.json` (definitions) + `apps/graphql-api-app/server/graphile/trigger-workflow.plugin.ts` (`triggerWorkflow` / `WORKFLOW_REGISTRY`); skill `n8n-cli` |
| Caddy config (dev proxy) | `docker/Caddyfile` |
| docker-compose | `docker-compose.yml` |

## Architecture deep-reference (`docs/specs/architecture-considerations/read-these/`)

Inline `→ [xx]` pointers in the checklist and special-cases files refer to these. Read them when
the topic comes up — not preemptively.

| Code | File | Topic |
|------|------|-------|
| a2 | `a2-auth-sql-helpers.md` | `jwt.*()` helper implementations and JWT payload shape |
| a3 | `a3-rls-policy-reference.md` | Complete RLS policy reference for every table |
| a4 | `a4-noinherit-explanation.md` | Why `authenticator` is `NOINHERIT` and what breaks without it |
| a6 | `a6-security-properties-table.md` | How each security property is enforced |
| b2 | `b2-built-in-license-types.md` | All built-in license types and which permissions they grant |
| b3 | `b3-license-pack-mechanics.md` | `number_of_licenses` semantics, `auto_subscribe`, expiration |
| b4 | `b4-anchor-module-tool-structure.md` | Module/tool nav tree for the anchor application |
| b5 | `b5-install-basic-application.md` | Exact SQL call signature with composite type casts |
| c1 | `c1-anchor-tenant-unique-indexes.md` | Partial unique indexes enforcing anchor tenant exclusivity |
| c2 | `c2-residency-uniqueness-constraints.md` | Three constraints enforcing the multi-residency model |
| c4 | `c4-handle-new-user-trigger.md` | HISTORICAL (trigger dropped at ZITADEL cutover) — provisioning now lives in `app_fn.provision_idp_user` |
| c5 | `c5-display-name-propagation.md` | HISTORICAL — per-module display_name trigger pattern (removed by the URN registry) |
| c6 | `c6-profile-claims-functions.md` | `profile_claims_for_user` vs `current_profile_claims` — when to call each |
| c7 | `c7-self-modification-prevention.md` | Self-mod check in `grant_user_license` |
| d1 | `d1-websocket-upgrade-auth.md` | `upgrade()` vs `open()` hook semantics — always auth in upgrade |
| d4 | `d4-pg-notify-channel-naming.md` | Channel name pattern: `topic:<id>:message` |
| d5 | `d5-pg-client-not-pool.md` | Why the pg-notify bridge uses a dedicated `pg.Client` not a pool |
| d6 | `d6-channel-peers-map.md` | Hand-rolled `channelPeers` Map — why we don't use crossws publish |
| e1 | `e1-cookie-refresh-pattern.md` | Session-cookie handling for session-changing operations |
| e2 | `e2-support-mode-detection.md` | Detecting support mode via `p:exit-support` permission |
| e3 | `e3-become-support-permission-check.md` | `canSupport` computed and post-support navigation pattern |
| g1 | `g1-sqitch-deployment-order.md` | Sqitch package dependency graph and cross-package syntax |
| pg | `postgraphile-service-setup.md` | PostGraphile 5 setup: routing, auth integration, problems solved |

> Some deep-reference docs predate the GraphQL migration and may describe the old REST/Kysely
> transport. Trust the code and the pattern files where they differ; the deep-reference docs
> remain accurate for the **DB / SQL / security** topics they cover.
