import { execSync } from 'child_process'
import { resolve } from 'path'
import { PG_URL } from './_env'

const sqlFile = process.argv[2]

if (!sqlFile) {
  console.error('Usage: db-exec.ts <path-to-sql-file>')
  process.exit(1)
}

const absPath = resolve(sqlFile)

execSync(
  `docker run --rm -i --network fnb-network -v "${absPath}:/tmp/exec.sql" postgres:18 psql ${PG_URL} -f /tmp/exec.sql`,
  { stdio: 'inherit' },
)
