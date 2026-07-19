# GraphQL Conversion Candidates

Purpose: track db-types hand-written functions that can migrate off REST/Kysely onto
PostGraphile GraphQL, following the "Converting a Page Stack from REST to GraphQL"
playbook in CLAUDE.md.

Scope: 11 of the 16 live hand-written db-types symbols. The pre-claims auth trio
(`loginUser`, `profileClaimsForUser`, `currentProfileClaims`) is explicitly OUT of scope
— it stays server-side in `fnb-db-access` because GraphQL requires claims to already exist.

## A. msg-layer read queries (5) → GraphQL queries — ✅ COMPLETE

Pure RLS table reads. Lowest risk. Documented pattern. All initial (non-WebSocket) reads now
run through the `DiscussionById` / `MySubscribedTopics` / `ActiveTenantResidents` GraphQL ops via
the graphql-client-api composables (`useMsgTopic`, `useMsgTopics`, `useMsgResidents`,
`useTopicMessages`).

| Query | Status |
|-------|--------|
| selectTopicById | ✅ served by `DiscussionById` (topic). REST route `topics/[id].get.ts` + query helper deleted. |
| selectRecentMessagesByTopicId | ✅ served by `DiscussionById` (messagesList). REST route `topics/[id]/messages/index.get.ts` + query helper deleted. |
| selectMessageWithSenderById | ⚠️ intentionally stays on REST — used only by the WebSocket incremental "new message" fetch (`topics/[id]/messages/[msgId].get.ts`). WebSockets do not use GraphQL. Route + helper retained. |
| selectMySubscribedTopics | ✅ served by `MySubscribedTopics` (useMsgTopics). REST route `topics/index.get.ts` now unused (not yet deleted). |
| selectResidentsByTenantId | ✅ served by `ActiveTenantResidents` (useMsgResidents). REST route `residents.get.ts` now unused (not yet deleted). |

Remaining optional cleanup: delete the two now-unused-but-still-present routes
(`topics/index.get.ts`, `residents.get.ts`) and their query helpers if desired.

## B. msg_api mutations (3) → GraphQL mutations

| Mutation | Maps to | Call site |
|----------|---------|-----------|
| upsertMessage | msg_api.upsert_message | topics/index.post.ts, topics/[id]/messages/index.post.ts |
| upsertSubscriber | msg_api.upsert_subscriber | topics/index.post.ts |
| upsertTopic | msg_api.upsert_topic | topics/index.post.ts |

Caveat: confirm the WebSocket publish path is DB-trigger/pg-notify driven (not TS-side)
before deleting the server route. If any publish logic lives in the TS handler, preserve it.

## C. app_api session mutations (3) → GraphQL + server cookie shim

| Mutation | Maps to | Call site |
|----------|---------|-----------|
| assumeResidency | app_api.assume_residency | apps/auth-app/server/api/assume-residency.post.ts |
| exitSupportMode | app_api.exit_support_mode | apps/auth-app/server/api/tenants/exit-support.post.ts |
| myProfileResidencies | app_api.my_profile_residencies (query) | apps/auth-app/server/api/my-residencies.get.ts |

Caveat: `assumeResidency` and `exitSupportMode` rewrite the `auth.user` cookie server-side
via `setAuthUserCookie(freshClaims)`. GraphQL can carry the DB call, but the cookie
side-effect must stay server-side. Recommended: keep the server route, swap only its
internal Kysely call for a GraphQL/db-access call — do NOT move these fully client-side.

## Ordering (low → high risk)

1. ~~Section A (5 msg reads)~~ — ✅ **DONE** (WS incremental read intentionally left on REST).
2. Section B (3 msg_api upserts) — verify WS/notify path first.
3. Section C (3 app_api session) — cookie side-effects + support mode; most care.

## Dependencies / blockers

- urql plugin must exist in each consuming app (see CLAUDE.md step 7).
- WebSocket flows still need server-side claims via `profileClaimsForUser` — that stays.
- These conversions are independent of the fnb-db-access work; can proceed in parallel.

## Out of scope (stay server-side raw pg in fnb-db-access)

- loginUser, profileClaimsForUser, currentProfileClaims (pre-claims root of trust).
- withClaims / createDb / buildJwtPayload retire as the migration completes.
