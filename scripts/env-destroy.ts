import { execSync } from 'child_process'

console.log('Stopping and removing all containers...')
try {
  execSync('docker compose down --volumes --remove-orphans', { stdio: 'inherit' })
} catch {}

console.log('Removing any remaining volumes...')
const volumes = execSync('docker volume ls -q').toString().trim().split('\n').filter(Boolean)
if (volumes.length) {
  try {
    execSync(`docker volume rm ${volumes.join(' ')}`, { stdio: 'inherit' })
  } catch {}
}

console.log('Removing fnb-network...')
try {
  execSync('docker network rm fnb-network', { stdio: 'inherit' })
} catch {}

console.log('Environment destroyed')
