// Pre-claims root of trust — raw pg. See .claude/issues/identified/db-types-conversion.md.
// Barrel must list every module: a missing export crashes the Node ESM loader at startup
// (not at build), pointing at dist/index.js.

// Mutations (pre-claims: claims bootstrap + OIDC provisioning — loginUser is retired,
// ZITADEL owns the login ceremony)
export { currentProfileClaims } from '@/mutations/current-profile-claims'
export { profileClaimsForUser } from '@/mutations/profile-claims-for-user'
export { provisionIdpUser } from '@/mutations/provision-idp-user'

// Server-side sessions (session-refresh-pattern.md): create at login, validate+touch per
// request, revoke at logout
export { createSession } from '@/mutations/create-session'
export { claimsForSession } from '@/mutations/claims-for-session'
export { revokeSession } from '@/mutations/revoke-session'

// Authorized (RLS) access outside the GraphQL context
export { withClaims } from '@/with-claims'
export { buildJwtPayload } from '@/jwt'
export type { JwtPayload } from '@/jwt'
export { selectMessageWithSenderById } from '@/queries/msg'
