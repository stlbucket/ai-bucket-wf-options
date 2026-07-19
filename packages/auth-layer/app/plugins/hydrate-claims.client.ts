import { useAuth } from '@function-bucket/fnb-auth-ui'
import { defineNuxtPlugin, navigateTo, onNuxtReady } from 'nuxt/app'

// Claims revalidation on every app boot (claims-revalidation-pattern.md). localStorage claims are
// only a mirror — the sealed httpOnly `session` cookie + auth.session row stay the root of trust,
// and the mirror can outlive them (stack rebuild, idle/absolute expiry, revocation). So always
// re-fetch instead of only self-healing the empty-storage case:
//   fresh valid            → mirror refreshed (also picks up newly granted permissions/modules)
//   fresh null, had claims → stale: cleared by refreshClaims; leave for the home hero + sign-in
//   fresh null, no claims  → stays logged out
//   fetch throws           → fail-soft: keep last-known claims (a transient API outage must not
//                            log the user out — only a definitive "no claims" response clears)
// Runs on the client only, after the app is ready (so the urql plugin has already provided
// $urqlClient — this is independent of plugin registration order). Each app behind nginx is its
// own Nuxt app, so every cross-app navigation is a full page load and re-runs this check.
export default defineNuxtPlugin((nuxtApp) => {
  onNuxtReady(() => {
    void nuxtApp.runWithContext(async () => {
      const { user, refreshClaims } = useAuth()
      const hadClaims = user.value !== null
      try {
        await refreshClaims()
      } catch (error) {
        console.error('[hydrate-claims] failed to load profile claims', error)
        return
      }
      // Stale claims detected: the browser thought it was logged in but the session is gone.
      // Land on the root home page (hero + sign-in button). Skip the navigation when already
      // there — clearing `user` flips the hero reactively, no reload needed.
      if (hadClaims && user.value === null && window.location.pathname !== '/') {
        await navigateTo('/?session=expired', { external: true })
      }
    })
  })
})
