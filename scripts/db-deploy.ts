import { execSync } from 'child_process'
import { resolve } from 'path'
import { DB_URL, PG_URL, REPO_ROOT, requiredEnv } from './_env'

// Ordered sqitch deploy list from .env (single source of truth — same var compose passes to
// db-migrate). Paths are db/<name>; db/db-config.ts's deployOnBuild flags are no longer consulted.
const deployPackages = requiredEnv('DEPLOY_PACKAGES').split(/\s+/).filter(Boolean)

// fnb-agent's policies change creates the agent_worker login role with this password
// (psql var :'agent_worker_password' — passed to every package deploy; unused vars are harmless).
const agentWorkerPassword = requiredEnv('AGENT_WORKER_PG_PASSWORD')

// fnb-n8n's policies change creates the n8n_worker login role the same way.
const n8nWorkerPassword = requiredEnv('N8N_WORKER_PG_PASSWORD')

const docker = (args: string) => execSync(`docker ${args}`, { stdio: 'inherit' })

for (const role of ['anon', 'authenticated', 'service_role']) {
  docker(
    `run --rm --network fnb-network postgres:latest psql "${PG_URL}" -c ` +
      `"DO \\$\\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') ` +
      `THEN CREATE ROLE ${role}; END IF; END \\$\\$;"`,
  )
}

for (const pkg of deployPackages) {
  docker(
    `run --rm --network fnb-network -v "${resolve(REPO_ROOT, 'db', pkg)}:/repo" sqitch/sqitch deploy --set agent_worker_password="${agentWorkerPassword}" --set n8n_worker_password="${n8nWorkerPassword}" "${DB_URL}"`,
  )
}

console.log('==> Running seed...')
docker(
  `run --rm --network fnb-network -v "${REPO_ROOT}/db/seed.sql:/seed.sql:ro" postgres:latest psql "${PG_URL}" -f /seed.sql`,
)
