// Sentry server-side init (project `fnb`). This file is loaded BEFORE Nuxt
// boots (via the module's `autoInjectServerSentry: 'top-level-import'`), so
// useRuntimeConfig() is NOT available here — read the DSN straight from
// process.env (the SENTRY_DSN compose env). An empty/undefined DSN makes
// Sentry.init a no-op (SDK disabled).
import * as Sentry from '@sentry/nuxt'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  // Getting-started baseline: full tracing. Lower in prod.
  tracesSampleRate: 1.0
})
