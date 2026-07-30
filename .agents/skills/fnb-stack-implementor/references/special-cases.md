# Special Cases & Failure Signatures

Read before touching auth, sessions, barrels, or anything that "looks like cleanup".

## Special cases to remember

- **`withClaims` is 2-arg** (`withClaims(claims, fn)`) and only in the `db-access` root-of-trust,
  the msg-layer WS carve-out, and the storage-layer upload endpoint. There is no `db`/trx param and
  no per-route `withClaims` on the default GraphQL path (grafast context handles it). Never write
  the retired 3-arg `withClaims(db, claims, trx => …)`.

- **Never GraphQL-ify the pre-claims functions.** `provisionIdpUser` / `createSession` /
  `claimsForSession` / `revokeSession` / `profileClaimsForUser` / `currentProfileClaims` — plus
  the first-run pair (`anchorExists` / `initializeAnchor`) and the OTP quick-login set
  (`getDeepLink` / `requestOtpLogin` / `verifyOtpLogin` / `sessionInfo` — spec
  `docs/specs/otp-login/`) — run before claims exist and stay raw `pg` in `db-access`. This is
  the most likely wrong "cleanup" — do not do it. (`loginUser` is retired — ZITADEL owns
  authentication. `createSession` takes an optional `authMethod` — `'zitadel'` default | `'otp'`.)

- **`to_jsonb` yields snake_case**; `db-access`'s `camelCaseKeys` recursively camelCases nested
  keys (the retired Kysely `CamelCasePlugin` behavior — memory
  `project_camelcase_plugin_nested_keys`). Don't reintroduce CamelCasePlugin language.

- **Claims live in localStorage, not a cookie.** `useAuth()` mirrors `ProfileClaims` to
  localStorage from GraphQL; the httpOnly `session` cookie stays the root of trust — a **sealed
  blob** (0010), managed only by auth-layer `server/utils/session.ts` (`setAppSession` /
  `readAppSession` / `clearAppSession`; `auth-cookies.ts` `deleteAuthCookies` clears it + the
  legacy `auth.user` cookie). Never `setCookie`/`getCookie` the session directly. Session-changing
  operations (login / `becomeSupport` / `exitSupportMode` / `assumeResidency`) re-fetch claims via
  GraphQL (`refreshClaims`) rather than rewriting a claims cookie. → [e1]

- **Mapper coverage (R3):** every composable returns `fnb-types` shapes via a
  `src/mappers/<entity>.ts` mapper — no inline shaping, no exporting generated types through the
  barrel (the `TopicStatus` leak, issue 0210).

- **Iconify per app:** each Nuxt app must declare `@iconify-json/*` directly or `i-lucide-*`
  icons render blank in Docker (memory `project_iconify_collection_per_app`).

- **Scoped license uniqueness:** one license per scope per application.
  `app_fn.grant_user_license` deletes the existing scoped license before inserting → [c7].

- **`profile_id` nullable on resident:** invited users have no profile yet;
  `app_fn.provision_idp_user` links pending residents at first login → [c4] (historical).

- **`NUXT_APP_BASE_URL`** must match the Caddy `handle` prefix (asset URLs, `<NuxtLink>`,
  `router.push`). Absolute client paths (`/_ws`, `/api/...`) bypass it — see signatures below.

- **`packages-watch` healthcheck** waits for `db-access`, `graphql-client-api`, `auth-server`,
  `auth-ui` dist files before apps start.

- **Anchor tenant:** `type='anchor'`, only one allowed; super admin / support licenses locked to
  the `anchor` license pack by partial unique indexes → [c1].

- **`app_fn.install_basic_application`:** the standard way to register a new module → [b5].

## Failure signatures

- **The barrel is the #1 miss (three barrels).** `packages/fnb-types/src/index.ts`,
  `packages/db-access/src/index.ts`, and `packages/graphql-client-api/src/index.ts` must each
  list every export or Node ESM crashes **at app startup** — `does not provide an export named
  'X'` pointing at `dist/index.js`. A runtime crash, not a build error. Always verify the barrel
  after adding a file.

- **Policies created but RLS never enabled = inert policies** (+ grant-all-anon exposure — the
  `msg_tenant` copy-paste bug). Verify:
  `select relname from pg_class where relnamespace::regnamespace::text = '<module>' and not relrowsecurity`.

- **GraphQL WS subscriptions resolve as `anon`** — the synthetic H3Event built from the raw
  upgrade request skips the auth middleware; claims must be attached in the grafast context
  (issue `0200__auth______ws-subscriptions-anon`).

- **Absolute client paths (`/_ws`, `/api/...`) bypass `NUXT_APP_BASE_URL`** and miss the proxy
  prefix block (issue `0110__msg_______realtime-nginx-routing`).

- **Blanket `GRANT EXECUTE ... IN SCHEMA <module>_fn` bypasses the `_api` gate** — grants on
  `_fn` belong to the specific definer-called functions only (issue
  `0020__security__fn-schema-grant-bypass`).

- **An SSR'd urql page 500s at request time**, not at build (UC14 — the urql plugin is
  client-only). Check `routeRules` coverage in the same change as any new urql page.

- **Codegen failures** (`TS6059` rootDir, missing `typescript-operations` plugin, `TS2308`
  double-export): see `rest-to-graphql-conversion.md` → step 2.
