import { Pool, types } from 'pg'
import { requiredEnv } from '@/utils/required-env'

// This package is the pre-claims "root of trust" plus the few authorized server-side reads that
// run outside GraphQL (login, middleware claims bootstrap, WS upgrade + WS message read). It owns
// its own pg Pool — the query surface is a handful of fixed stored-function calls plus one RLS
// read, so raw pg is lighter than a query builder. (This replaced the Kysely-based fnb-db-types.)

let pool: Pool | undefined
let citextArrayRegistered = false

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: requiredEnv('DATABASE_URL') })
  }
  return pool
}

// citext is an extension type with a dynamic OID — query it once and register a parser so
// citext[] columns return string[] instead of the raw '{val1,val2}' literal.
async function ensureCitextArrayParser(p: Pool): Promise<void> {
  if (citextArrayRegistered) return
  const { rows } = await p.query(`SELECT typarray FROM pg_type WHERE typname = 'citext'`)
  const citextArrayOid = rows[0]?.typarray
  if (citextArrayOid) {
    types.setTypeParser(citextArrayOid, (val: string | null) =>
      val === null ? null : val.replace(/^\{|\}$/g, '').split(',').filter(Boolean),
    )
  }
  citextArrayRegistered = true
}

// Single fixed-arg stored-function query helper. Returns all rows.
export async function query<T>(text: string, params: unknown[]): Promise<T[]> {
  const p = getPool()
  await ensureCitextArrayParser(p)
  const { rows } = await p.query(text, params as never[])
  return rows as T[]
}
