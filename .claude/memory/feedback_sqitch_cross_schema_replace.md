---
name: Cross-schema CREATE OR REPLACE in sqitch reverts
description: It is expected that some msg/fn deploy scripts use CREATE OR REPLACE on functions owned by other schemas (e.g. app_fn). Revert cannot restore the prior definition.
type: feedback
originSessionId: 0e5dbd3c-69f7-438c-8d10-40ce546a01b3
---
When a sqitch deploy script uses `CREATE OR REPLACE FUNCTION` on a function in a foreign schema (e.g. `app_fn.tg__graphql_subscription()`), the revert script cannot restore the prior definition and should just drop the function with a `-- TODO` note.

**Why:** These cross-schema replacements are intentional — the msg package (and similar feature packages) extend shared infrastructure functions. The prior definition is not known at deploy time.

**How to apply:** When generating revert scripts for this project, do not flag `CREATE OR REPLACE` on foreign-schema functions as a problem requiring manual intervention. Add a `-- TODO` comment and drop the function. The user is aware.
