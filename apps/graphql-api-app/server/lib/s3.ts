import { S3Client } from '@aws-sdk/client-s3'
import { requiredEnv } from './required-env.js'

// graphql-api-app-local S3 client — used for SIGNING ONLY (the downloadUrl presign field).
// It never writes objects; storage-layer owns the upload PutObject and worker-app owns the scan
// pipeline's GetObject/CopyObject/DeleteObject. Presigning is a
// local HMAC operation (no S3 round-trip), so per-row generation in a list query is cheap.
// Deliberate ~15-line duplication of packages/storage-layer/server/lib/s3.ts (infrastructure.md §1e).
//
// IMPORTANT: presign against the BROWSER-reachable endpoint, not the internal Docker one. The
// signed URL is handed to the user's browser, and a SigV4 signature is Host-bound, so it must be
// signed for the host the browser actually hits — dev: localhost:9000; prod: the public S3/CDN
// origin. We derive that origin from S3_PUBLIC_BASE_URL (…/<bucket>), falling back to S3_ENDPOINT.
// (S3_ENDPOINT = http://minio:9000 only resolves inside the compose network — a presigned URL to
// it 404s/ENOTFOUND in the browser.)
const presignEndpoint = new URL(requiredEnv('S3_PUBLIC_BASE_URL')).origin

export const s3 = new S3Client({
  endpoint: presignEndpoint,
  region: requiredEnv('S3_REGION'),
  forcePathStyle: requiredEnv('S3_FORCE_PATH_STYLE') === 'true', // MinIO needs path-style
  credentials: {
    accessKeyId: requiredEnv('S3_ACCESS_KEY'),
    secretAccessKey: requiredEnv('S3_SECRET_KEY')
  }
})
