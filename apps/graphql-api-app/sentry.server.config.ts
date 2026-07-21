// Sentry server-side init (project `fnb`). Loaded BEFORE Nuxt boots (via the
// module's `autoInjectServerSentry: 'top-level-import'`), so useRuntimeConfig()
// is NOT available here — read the DSN from process.env.SENTRY_DSN. An
// empty/undefined DSN makes Sentry.init a no-op (SDK disabled).
import * as Sentry from '@sentry/nuxt'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: 1.0
})
