// Pre-claims root of trust — raw pg. See .claude/issues/identified/db-types-conversion.md.
// Barrel must list every module: a missing export crashes the Node ESM loader at startup
// (not at build), pointing at dist/index.js.

// Mutations (pre-claims: claims bootstrap + OIDC provisioning — loginUser is retired,
// ZITADEL owns the login ceremony)
export { currentProfileClaims } from '@/mutations/current-profile-claims'
export { profileClaimsForUser } from '@/mutations/profile-claims-for-user'
export { provisionIdpUser } from '@/mutations/provision-idp-user'

// First-run setup (pre-claims, R5 carve-out): virgin-env bootstrap from /auth/setup
export { anchorExists } from '@/queries/anchor-exists'
export { initializeAnchor } from '@/mutations/initialize-anchor'
export type { InitializeAnchorInput } from '@/mutations/initialize-anchor'

// Server-side sessions (session-refresh-pattern.md): create at login, validate+touch per
// request, revoke at logout
export { createSession } from '@/mutations/create-session'
export { claimsForSession } from '@/mutations/claims-for-session'
export { revokeSession } from '@/mutations/revoke-session'

// OTP login (spec .claude/specs/otp-login/): pre-claims deep-link read + code request/verify +
// session-info for the temporary-session banner. All raw pg, called by auth-app's /auth/api/otp/*
// routes before any session exists.
export { getDeepLink } from '@/queries/get-deep-link'
export type { DeepLinkPublic } from '@/queries/get-deep-link'
export { sessionInfo } from '@/queries/session-info'
export type { SessionInfo } from '@/queries/session-info'
export { requestOtpLogin } from '@/mutations/request-otp-login'
export type { OtpLoginDispatch } from '@/mutations/request-otp-login'
export { verifyOtpLogin } from '@/mutations/verify-otp-login'

// Authorized (RLS) access outside the GraphQL context
export { withClaims } from '@/with-claims'
export { buildJwtPayload } from '@/jwt'
export type { JwtPayload } from '@/jwt'
export { selectMessageWithSenderById } from '@/queries/msg'
export { selectMyIdpUserId } from '@/queries/profile'
