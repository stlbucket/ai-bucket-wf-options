---
name: Explicit imports required in layer packages
description: When editing files in shared layer packages, all imports must be explicit — no relying on ambient types or auto-imports
type: feedback
---

Always use explicit imports for everything when editing files inside layer packages (e.g. `packages/auth-layer`, `packages/msg-layer`, etc.). Do not rely on Nuxt/Nitro auto-imports or ambient type availability.

**Why:** Layer packages don't get auto-import injection at runtime (unlike apps), so missing explicit imports cause ReferenceErrors at runtime — not just TypeScript errors. This was confirmed when all msg-layer server files were silently failing because `defineEventHandler`, `createError`, `useNitroApp`, etc. were undefined.

**Import sources for Nitro/H3 server files in layers:**
- `h3`: `defineEventHandler`, `defineWebSocketHandler`, `createError`, `getCookie`, `getRouterParam`, `readBody`
- `nitropack/runtime`: `defineNitroPlugin`, `useNitroApp`
- Relative paths: `getEventClaims` and other local utils (no auto-import of utils either)

**How to apply:** Any time I'm editing a `.ts` or `.vue` file inside a `packages/` layer directory, explicitly import every type, composable, utility, and API used in that file — including functions that would normally be auto-imported in an app.
