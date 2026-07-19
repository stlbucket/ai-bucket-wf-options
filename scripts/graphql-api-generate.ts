import { execSync } from 'child_process'

const root = new URL('..', import.meta.url).pathname

console.log('Running GraphQL codegen...')
execSync('pnpm --filter @function-bucket/fnb-graphql-client-api generate', {
  stdio: 'inherit',
  cwd: root,
})
console.log('Done.')
