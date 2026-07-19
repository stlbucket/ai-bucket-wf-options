import type { H3Event } from 'h3'
import type { ProfileClaims } from '@function-bucket/fnb-types'

// Per-request auth context, derived from the `session` cookie (see applyEventClaims). Lives here —
// the shared auth-layer — now that the Kysely db.ts plugins that used to declare it are gone.
declare module 'h3' {
  interface H3EventContext {
    user: { id: string } | undefined
    claims: ProfileClaims | undefined
  }
}

/**
 * The single path for putting profile claims on a request.
 *  - resolves fresh claims from the `session` cookie via getEventClaims
 *  - stashes them on event.context (user + claims) for downstream handlers
 *
 * Claims are NOT written to a cookie anymore (the full JSON overflows the response header for
 * large profiles). The client fetches claims via GraphQL into localStorage; the server derives
 * them per-request from the `session` cookie purely for authz / RLS.
 *
 * Registered by the server middleware in tenant-layer (covers every tenant app)
 * and auth-app (which extends auth-layer directly, not tenant-layer).
 */
export async function applyEventClaims(event: H3Event) {
  const { user, claims } = await getEventClaims(event)
  event.context.user = user
  event.context.claims = claims
}
