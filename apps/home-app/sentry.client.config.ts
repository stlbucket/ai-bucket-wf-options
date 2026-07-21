// Sentry browser-side init (project `fnb`). Loaded by @sentry/nuxt/module.
// The DSN is a PUBLIC value (it ships to the browser); it comes from the
// NUXT_PUBLIC_SENTRY_DSN runtime env via runtimeConfig.public.sentryDsn.
// An empty DSN makes Sentry.init a no-op (SDK disabled), so a missing env var
// silently disables Sentry instead of breaking the app.
import * as Sentry from '@sentry/nuxt'
import { useRuntimeConfig } from '#imports'

const config = useRuntimeConfig()

Sentry.init({
  dsn: config.public.sentryDsn as string,
  environment: import.meta.dev ? 'development' : 'production',
  // Getting-started baseline: full tracing so spans are visible. Lower in prod.
  tracesSampleRate: 1.0
})
