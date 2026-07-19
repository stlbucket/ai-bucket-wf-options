import pg from 'pg'
import { requiredEnv } from './required-env'

const pool = new pg.Pool({
  connectionString: requiredEnv('DATABASE_URL'),
})

async function doQuery(sql: string, params?: unknown[]) {
  const client = await pool.connect()
  try {
    return await client.query(sql, params)
  } catch (e: unknown) {
    console.error('PG CLIENT ERROR:', (e as Error).message, sql.slice(0, 50))
    throw e
  } finally {
    client.release()
  }
}

const useFnbPgClient = () => ({ doQuery })

export { pool, doQuery, useFnbPgClient }
