import pg from 'pg'
import { requiredEnv } from '../required-env'

// The agent_worker pool — the ONLY database access agent-app has. Held by tool handlers and
// the harness/trigger plumbing; the model never sees a connection string and never writes SQL —
// it can only invoke the closed, zod-validated toolbox (_shared.data.md → Security model).
let pool: pg.Pool | undefined

export function agentWorkerPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({
      host: requiredEnv('PGHOST'),
      port: parseInt(process.env.PGPORT ?? '5432'),
      database: requiredEnv('PGDATABASE'),
      user: 'agent_worker',
      password: requiredEnv('AGENT_WORKER_PG_PASSWORD'),
      max: 5
    })
  }
  return pool
}

export async function agentWorkerQuery<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  return agentWorkerPool().query<T>(text, params as never[])
}
