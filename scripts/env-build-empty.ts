import { execSync } from 'child_process'
import net from 'node:net'
import { requiredEnv } from './_env'

// first-run-setup (.claude/specs/first-run-setup/infrastructure.md): the EMPTY-env entry point.
// Identical to env-build.ts except it sets SEED_DATA=empty in the compose child env, so the stack
// comes up with the schema deployed but NO seed data beyond the app-install path (no anchor
// tenant, no profiles, no ZITADEL user roster). First open → /auth/setup bootstraps the anchor.
// env-build.ts is deliberately left byte-for-byte untouched; isPortFree is duplicated here rather
// than shared, to keep that guarantee.
const PORT = Number(requiredEnv('PORT'))

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => server.close(() => resolve(true)))
    server.listen(port, '0.0.0.0')
  })
}

;(async () => {
  if (!(await isPortFree(PORT))) {
    console.error(
      `Port ${PORT} is already in use — edit PORT in .env (and the http://localhost:${PORT} ` +
        `URLs that embed it), then retry.`,
    )
    process.exit(1)
  }

  console.log(`Starting EMPTY env (no seed data) on http://localhost:${PORT}`)
  console.log('First open → /auth/setup to create the anchor tenant + site admin.')

  execSync('docker compose up --build', {
    stdio: 'inherit',
    env: { ...process.env, SEED_DATA: 'empty' },
  })
})()
