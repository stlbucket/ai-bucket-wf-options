import { execSync } from 'child_process'
import { DB_URL, REPO_ROOT } from './_env'

execSync(
  `docker run --rm --network fnb-network -v "${REPO_ROOT}/db/fnb-auth:/repo" sqitch/sqitch status ${DB_URL}`,
  { stdio: 'inherit' },
)
