import { execSync } from 'child_process'
import { PG_URL } from './_env'

execSync(
  `docker run --rm -it --network fnb-network postgres:18 psql ${PG_URL}`,
  { stdio: 'inherit' },
)
