import type { PoolClient } from 'pg'
import { getPool } from '@/pool'
import { buildJwtPayload } from '@/jwt'
import type { ProfileClaims } from '@function-bucket/fnb-types'

// Runs `fn` inside a transaction scoped to the `authenticated` role with the caller's claims set on
// `request.jwt.claims`, so RLS policies fire exactly as they did under the Kysely withClaims. Used
// for authorized reads that run outside the GraphQL context (currently the WebSocket incremental
// message read). The trio functions (login / claims bootstrap) don't need this — they call
// SECURITY DEFINER functions as `authenticator` via the plain pool.
export async function withClaims<T>(
  claims: ProfileClaims,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const payload = JSON.stringify(buildJwtPayload(claims))
  const client = await getPool().connect()
  try {
    await client.query('begin')
    await client.query('set local role authenticated')
    await client.query(`select set_config('request.jwt.claims', $1, true)`, [payload])
    const result = await fn(client)
    await client.query('commit')
    return result
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}
