// No fallback — PING_INTERVAL must come from .env via docker-compose (${PING_INTERVAL:?}).
if (!process.env.PING_INTERVAL) {
  console.error('PING_INTERVAL is required (set it in .env)')
  process.exit(1)
}
const INTERVAL_SECONDS = parseInt(process.env.PING_INTERVAL, 10)

const TARGETS = [
  { name: 'auth-app', url: 'http://auth-app:3000/auth' },
  { name: 'tenant-app', url: 'http://tenant-app:3000/tenant' },
  { name: 'home-app', url: 'http://home-app:3000' },
  { name: 'msg-app', url: 'http://msg-app:3000/msg' },
  { name: 'graphql-api-app', url: 'http://graphql-api-app:3000/graphql-api' },
  // { name: 'storage-app', url: 'http://graphql-api-app:3000/storage' },
]

async function ping(target) {
  try {
    const res = await fetch(target.url, { signal: AbortSignal.timeout(5000) })
    console.log(`[OK]   ${target.name} ${res.status}`)
  } catch (err) {
    console.log(`[FAIL] ${target.name}: ${err.message}`)
  }
}

async function pingAll() {
  await Promise.allSettled(TARGETS.map(ping))
}

console.log(`pinger started — interval ${INTERVAL_SECONDS}s`)
pingAll()
setInterval(pingAll, INTERVAL_SECONDS * 1000)
