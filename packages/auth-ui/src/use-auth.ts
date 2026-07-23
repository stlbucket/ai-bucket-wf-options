import { navigateTo, useRequestFetch, useRuntimeConfig, useNuxtApp } from 'nuxt/app'
import { computed, type Ref } from 'vue'
import { useStorage, StorageSerializers } from '@vueuse/core'
import {
  fetchProfileClaims,
  exitSupportMode,
  assumeResidency,
} from '@function-bucket/fnb-graphql-client-api'
import type { ProfileClaims } from '@function-bucket/fnb-types'

export type { ProfileClaims }

export type UseAuthReturn = {
  user: Ref<ProfileClaims | null>
  isLoggedIn: Ref<boolean>
  loginWithRedirect: (returnTo?: string) => Promise<void>
  logout: () => Promise<void>
  goHome: () => Promise<void>
  exitSupport: () => Promise<void>
  switchResidency: (residentId: string) => Promise<void>
  refreshClaims: () => Promise<void>
}


export const useAuth = (): UseAuthReturn => {
  // Claims live in localStorage (not a cookie) — the full ProfileClaims JSON is too large for the
  // super-admin to fit in a Set-Cookie header (proxy 502). The httpOnly `session` cookie remains
  // the auth root of trust; claims are (re)fetched from GraphQL and mirrored here. useStorage is
  // SSR-safe (returns the default on the server, hydrates from localStorage on the client).
  const user = useStorage<ProfileClaims | null>('auth.user', null, undefined, {
    serializer: StorageSerializers.object,
  })
  const isLoggedIn = computed(() => user.value !== null)

  const config = useRuntimeConfig()
  const authBase = import.meta.server
    ? (config.authAppInternalUrl as string) || config.public.authAppUrl
    : config.public.authAppUrl

  const logoutApiUrl = `${authBase}/api/auth/logout`
  const homeUrl = '/'

  const fetch = useRequestFetch()

  // Pull the app's urql client off the Nuxt app (provided by each app's urql plugin). Using the
  // provide (rather than useClient() inject) means this also works from plugins / route middleware.
  function getClient() {
    const nuxtApp = useNuxtApp() as unknown as { $urqlClient: unknown }
    return nuxtApp.$urqlClient as Parameters<typeof fetchProfileClaims>[0]
  }

  async function refreshClaims(): Promise<void> {
    user.value = await fetchProfileClaims(getClient())
  }

  // ZITADEL hosted-login ceremony (zitadel-login-pattern.md): browser-only full-page redirect
  // to the auth-app OIDC start route; the callback sets the same sealed session cookie and
  // lands on /login?oidc=success, where claims hydrate via the normal GraphQL path.
  //
  // Optional `returnTo` (root-relative path) rides the whole round-trip so the caller lands back
  // where they started instead of home — the deep-link "Sign in with ZITADEL" case
  // (auth-app/login.data.md §Return-to). It is validated (isSafeReturnTo) server-side at park time
  // and again on consume; here we only forward it as a query param.
  async function loginWithRedirect(returnTo?: string): Promise<void> {
    const base = `${config.public.authAppUrl}/api/auth/oidc/login`
    const url = returnTo ? `${base}?returnTo=${encodeURIComponent(returnTo)}` : base
    await navigateTo(url, { external: true })
  }

  async function logout(): Promise<void> {
    // Server side revokes the auth.session row + clears the sealed cookie. Best-effort: local
    // claims are cleared in `finally` so this browser ends up logged out even when the network
    // call rejects (0180 Tier 1, session-refresh-pattern.md).
    try {
      await fetch(logoutApiUrl, { method: 'POST' })
    } catch {
      // swallow — the SSO logout redirect below must still run
    } finally {
      user.value = null
    }
    // End the ZITADEL SSO session too (RP-initiated logout). The server route 302s to
    // /oidc/v1/end_session with the registered post-logout redirect back to home — harmless
    // when no ZITADEL session exists (password login), it just redirects through.
    await navigateTo(`${config.public.authAppUrl}/api/auth/oidc/logout`, { external: true })
  }

  async function goHome(): Promise<void> {
    await navigateTo(homeUrl, { external: true })
  }

  async function exitSupport(): Promise<void> {
    await exitSupportMode(getClient())
    await refreshClaims()
    await goHome()
  }

  // Workspace-switcher action: assume the target residency, refetch claims, then full-reload
  // home (goHome navigates with { external: true } — the workspace-Enter contract; nav and urql
  // caches rebuild under the new tenant). Errors propagate — the component toasts them (UC7)
  // and neither claims nor location change.
  async function switchResidency(residentId: string): Promise<void> {
    await assumeResidency(getClient(), residentId)
    await refreshClaims()
    await goHome()
  }

  return {
    user,
    isLoggedIn,
    loginWithRedirect,
    logout,
    goHome,
    exitSupport,
    switchResidency,
    refreshClaims,
  }
}
