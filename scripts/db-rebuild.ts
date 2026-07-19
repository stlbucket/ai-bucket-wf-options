import { execSync } from 'child_process'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { maintenancePgUrl, PG_URL } from './_env'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))

// Target DB name from PG_URL's path segment — no hardcoded 'fnb'.
const dbName = new URL(PG_URL).pathname.replace(/^\//, '')

console.log(`Dropping and recreating database "${dbName}"...`)
execSync(
  'docker run --rm --network fnb-network postgres:latest' +
    ` psql "${maintenancePgUrl()}"` +
    ` -c "DROP DATABASE IF EXISTS ${dbName};"` +
    ` -c "CREATE DATABASE ${dbName};"`,
  { stdio: 'inherit' },
)

console.log('Deploying all migrations...')
execSync(`tsx ${resolve(SCRIPT_DIR, 'db-deploy.ts')}`, { stdio: 'inherit' })

console.log('Rebuild complete')
