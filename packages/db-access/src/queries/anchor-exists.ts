import { query } from '@/pool'

// Pre-claims read (first-run-setup, R5 carve-out): "does setup still need to run?".
// Called from auth-app's /auth/setup status endpoint + the initialize pre-check BEFORE any
// claims exist. Wraps app_fn.anchor_exists() (SECURITY DEFINER, granted to authenticator).
export async function anchorExists(): Promise<boolean> {
  const rows = await query<{ exists: boolean }>(
    `select app_fn.anchor_exists() as exists`,
    [],
  )
  return rows[0].exists
}
