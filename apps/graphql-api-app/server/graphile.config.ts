import { PostGraphileAmberPreset } from 'postgraphile/presets/amber'
import { PgSimplifyInflectionPreset } from '@graphile/simplify-inflection'
import { makePgService } from 'postgraphile/adaptors/pg'
import { makeV4Preset } from 'postgraphile/presets/v4'
import { H3Event } from 'h3'
import { ServerResponse } from 'node:http'
import { TagsFilePlugin } from 'postgraphile/utils'
import { AssetDownloadUrlPlugin } from './graphile/asset-download-url.plugin.js'
import { TriggerWorkflowPlugin } from './graphile/trigger-workflow.plugin.js'
import { requiredEnv } from './lib/required-env.js'

const baseUrl = requiredEnv('NUXT_APP_BASE_URL')

const preset: GraphileConfig.Preset = {
  plugins: [TagsFilePlugin, AssetDownloadUrlPlugin, TriggerWorkflowPlugin],
  extends: [
    PostGraphileAmberPreset,
    PgSimplifyInflectionPreset,
    makeV4Preset({
      simpleCollections: 'both',
      disableDefaultMutations: true,
      dynamicJson: true
    })
    /* Add more presets here */
  ],
  pgServices: [
    makePgService({
      connectionString: requiredEnv('DATABASE_URL'),
      schemas: [
        'app',
        'app_api',
        'msg',
        'msg_api',
        'loc',
        'loc_api',
        'todo',
        'todo_api',
        'n8n',
        'n8n_api',
        'storage',
        'location_datasets',
        'location_datasets_api',
        'airports',
        'airports_api',
        'game',
        'game_api',
        'res',
        'res_api'
      ]
    })
  ],
  grafserv: {
    graphqlPath: `${baseUrl}/api/graphql`,
    eventStreamPath: `${baseUrl}/api/graphql/stream`,
    graphiql: true,
    watch: process.env.NODE_ENV !== 'production'
  },
  grafast: {
    explain: process.env.NODE_ENV !== 'production',
    async context(requestContext, args) {
      const pgSettings = {
        ...(args.contextValue?.pgSettings as Record<string, string | undefined>)
      }

      // HTTP: h3v1.event is populated by the grafserv H3 adaptor after Nuxt middleware runs
      // WebSocket: construct H3Event from raw request (middleware context not carried over)
      const event
        = requestContext.h3v1?.event
          ?? (requestContext.ws
            ? new H3Event(
                requestContext.ws.request._req,
                new ServerResponse(requestContext.ws.request._req)
              )
            : undefined)

      const claims = event?.context?.claims

      if (claims) {
        pgSettings.role = 'authenticated'
        pgSettings['request.jwt.claims'] = JSON.stringify({
          email: claims.email,
          display_name: claims.displayName,
          user_metadata: {
            profile_id: claims.profileId,
            tenant_id: claims.tenantId,
            resident_id: claims.residentId,
            actual_resident_id: claims.actualResidentId,
            permissions: claims.permissions ?? []
          }
        })
      } else {
        pgSettings.role = 'anon'
      }

      // claims ride the grafast context for extendSchema plugins (TriggerWorkflowPlugin's
      // 401 gate + allow-map check) — pgSettings stays the RLS path.
      return { ...args.contextValue, pgSettings, claims }
    }
  }
}

export default preset
