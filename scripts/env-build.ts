import { execSync } from 'child_process'
import net from 'node:net'
import { requiredEnv } from './_env'

// D1: no port hunting. PORT lives in .env verbatim (baked into every http://localhost:PORT URL);
// docker compose reads it directly. We only preflight that the port is free and fail fast with a
// clear message — the fix is to edit PORT in .env AND the URLs that embed it. We do NOT inject
// DEPLOY_PACKAGES here anymore: .env is the single source (compose reads ${DEPLOY_PACKAGES:?}).
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

  console.log(`Starting on http://localhost:${PORT}`)

  execSync('docker compose up --build', { stdio: 'inherit' })
})()
