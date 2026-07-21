// Sentry browser-side init (project `fnb`). Loaded by @sentry/nuxt/module
// (registered in auth-layer). The DSN is PUBLIC (it ships to the browser) and
// comes from NUXT_PUBLIC_SENTRY_DSN via runtimeConfig.public.sentryDsn (defined
// in auth-layer). An empty DSN makes Sentry.init a no-op (SDK disabled).
import * as Sentry from '@sentry/nuxt'
import { useRuntimeConfig } from '#imports'

const config = useRuntimeConfig()

Sentry.init({
  dsn: config.public.sentryDsn as string,
  environment: import.meta.dev ? 'development' : 'production',
  tracesSampleRate: 1.0
})
