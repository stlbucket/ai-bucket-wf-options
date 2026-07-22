// GET /auth/api/setup/status → { needsSetup }
//
// First-run setup (spec: .claude/specs/first-run-setup/setup.data.md). Unauthenticated,
// read-only, no side effects — consumed by the /auth/setup page mount gate and the login-page
// redirect. Deliberately does NOT require the SETUP_TOKEN: it only reveals the boolean, which is
// already inferable, and the page needs it to gate the mount. Pre-claims raw pg (R5 carve-out).

import { anchorExists } from '@function-bucket/fnb-db-access'

export default defineEventHandler(async () => {
  const exists = await anchorExists()
  return { needsSetup: !exists }
})
