import { S3Client } from '@aws-sdk/client-s3'
import { requiredEnv } from '../required-env'

// Module-level singleton for the asset-scan toolbox: GetObject (scan stream + thumbnail source),
// Copy/Delete (promote or purge), PutObject (thumbnail). Reimplements the retired worker-app
// client — held by tool handlers only; the model never sees it. MinIO requires path-style.
let client: S3Client | undefined

export function s3(): S3Client {
  if (!client) {
    client = new S3Client({
      endpoint: requiredEnv('S3_ENDPOINT'),
      region: requiredEnv('S3_REGION'),
      forcePathStyle: requiredEnv('S3_FORCE_PATH_STYLE') === 'true',
      credentials: {
        accessKeyId: requiredEnv('S3_ACCESS_KEY'),
        secretAccessKey: requiredEnv('S3_SECRET_KEY')
      }
    })
  }
  return client
}
