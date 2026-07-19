import { execSync } from 'child_process'

execSync('docker stop function_bucket', { stdio: 'inherit' })
execSync('docker rm function_bucket', { stdio: 'inherit' })

console.log('Postgres stopped and removed')
