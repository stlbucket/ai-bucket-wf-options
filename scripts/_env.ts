import { config } from 'dotenv'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

// Shared env loader for host-side db/* scripts. Loads the repo-root .env (the single source of
// truth) and exposes a fail-fast reader. Every db script imports from here instead of hardcoding
// connection strings — change a value in one place (.env), never in code.
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// override:false → a var already exported into the shell still wins (deliberate override path).
config({ path: resolve(REPO_ROOT, '.env'), override: false })

export function requiredEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required environment variable: ${name} (set it in .env)`)
  return v
}

// psql (postgresql://…) and sqitch (db:pg://…) connection strings, straight from .env.
export const PG_URL = requiredEnv('PG_URL')
export const DB_URL = requiredEnv('DB_URL')

// The maintenance-DB variant of PG_URL (…/postgres) — for DROP/CREATE DATABASE, which can't run
// while connected to the target DB. Derived by swapping the database path segment; no extra var.
export function maintenancePgUrl(): string {
  const u = new URL(PG_URL)
  u.pathname = '/postgres'
  return u.toString()
}
