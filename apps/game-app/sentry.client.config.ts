// Sentry browser-side init (project `fnb`). Loaded by @sentry/nuxt/module
// (registered in auth-layer). game-app is WS-only (no user pages), so this
// client init is effectively inert — kept for parity with the other apps.
// DSN is PUBLIC and comes from NUXT_PUBLIC_SENTRY_DSN via
// runtimeConfig.public.sentryDsn (auth-layer). Empty DSN => Sentry.init no-op.
import * as Sentry from '@sentry/nuxt'
import { useRuntimeConfig } from '#imports'

const config = useRuntimeConfig()

Sentry.init({
  dsn: config.public.sentryDsn as string,
  environment: import.meta.dev ? 'development' : 'production',
  tracesSampleRate: 1.0
})
