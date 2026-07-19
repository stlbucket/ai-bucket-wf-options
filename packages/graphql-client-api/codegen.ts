import type { CodegenConfig } from '@graphql-codegen/cli'
import { config as loadEnv } from 'dotenv'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

// Load the repo-root .env (single source of truth) so the schema URL isn't hardcoded here.
loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../.env') })

const schemaUrl = process.env.GRAPHQL_SCHEMA_URL
if (!schemaUrl) {
  throw new Error('Missing required environment variable: GRAPHQL_SCHEMA_URL (set it in .env)')
}

const config: CodegenConfig = {
  schema: schemaUrl,
  documents: ['src/graphql/**/*.graphql'],
//   ignoreNoDocuments: true, // for better experience with the watcher
  generates: {
    'src/generated/fnb-graphql-api.ts': {
      plugins: [
        'typescript',
        'typescript-operations',
        'typescript-vue-urql',
      ],
      config: {
        gqlImport: '@urql/vue#gql',
        arrayInputCoercion: false,
        nonOptionalTypename: true
      }
    },
    'src/generated/schema.json': {
      plugins: [
        'introspection'
      ]
    },
    'src/generated/schema.min.json': {
      plugins: [
        'urql-introspection'
      ]
    },
  },
}

export default config


