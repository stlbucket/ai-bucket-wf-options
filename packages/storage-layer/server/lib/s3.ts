import { S3Client } from '@aws-sdk/client-s3'
import { requiredEnv } from './required-env'

// Lazy memoized singleton (not module-level): apps that extend storage-layer without S3 creds
// (tenant-app — its uploads POST cross-app to storage-app) must not crash at boot on the env
// check; the Nitro dev bundle evaluates route-module top-level code eagerly. Env is validated on
// first use instead — compose's `${S3_*:?}` interpolation stays the boot-time guard for
// storage-app. Used for exactly one write: PutObject at upload (quarantine key). The scan
// pipeline's Get/Copy/Delete lives in worker-app; graphql-api-app keeps its own copy for
// presign-only. MinIO requires path-style addressing.
let _s3: S3Client | undefined

export function getS3(): S3Client {
  _s3 ??= new S3Client({
    endpoint: requiredEnv('S3_ENDPOINT'),
    region: requiredEnv('S3_REGION'),
    forcePathStyle: requiredEnv('S3_FORCE_PATH_STYLE') === 'true',
    credentials: {
      accessKeyId: requiredEnv('S3_ACCESS_KEY'),
      secretAccessKey: requiredEnv('S3_SECRET_KEY'),
    },
  })
  return _s3
}
