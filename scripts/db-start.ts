import { execSync } from 'child_process'
import { requiredEnv } from './_env'

const POSTGRES_DB = requiredEnv('POSTGRES_DB')
const POSTGRES_USER = requiredEnv('POSTGRES_USER')
const POSTGRES_PASSWORD = requiredEnv('POSTGRES_PASSWORD')
const DB_HOST_PORT = requiredEnv('DB_HOST_PORT')

try {
  execSync('docker network create fnb-network', { stdio: 'pipe' })
} catch {}

execSync(
  'docker run -d' +
    ' --name function_bucket' +
    ' --network fnb-network' +
    ' --platform linux/amd64' +
    ` -e POSTGRES_DB=${POSTGRES_DB}` +
    ` -e POSTGRES_USER=${POSTGRES_USER}` +
    ` -e POSTGRES_PASSWORD=${POSTGRES_PASSWORD}` +
    ` -p ${DB_HOST_PORT}:5432` +
    ' postgis/postgis',
  { stdio: 'inherit' },
)

console.log(`Postgres started on port ${DB_HOST_PORT}`)
