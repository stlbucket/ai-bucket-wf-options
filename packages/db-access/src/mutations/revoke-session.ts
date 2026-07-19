import { query } from '@/pool'

// Called by logout with the sid from the unsealed cookie. Idempotent — revoking an already
// revoked or unknown session is a no-op; logout stays 200-unconditional either way.
// Spec: .claude/specs/future-auth/session-refresh-pattern.md.
export async function revokeSession(sessionId: string): Promise<void> {
  await query(`select app_fn.revoke_session($1::uuid)`, [sessionId])
}
