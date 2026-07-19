import type { ApplicationFragment } from '../generated/fnb-graphql-api'
import type { Application } from '@function-bucket/fnb-types'

export const toApplication = (f: ApplicationFragment): Application => ({
  key: f.key,
  name: f.name,
  licenseCount: f.licenseCount ?? null,
})
