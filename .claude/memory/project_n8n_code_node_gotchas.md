---
name: n8n-code-node-gotchas
description: n8n Code-node + workflow-iteration gotchas — $env is blocked (use process.env), no URL global, localhost→::1, and import+publish+restart to reload a workflow.
metadata:
  type: project
---

Hard-won while building the `invite-user` workflow (user-invitation spec, 2026-07-22). These cost
several failed runs + restarts; check them before writing any n8n Code node or self-calling webhook.

**`$env` is blocked instance-wide** — `{{ $env.FOO }}` in a node expression OR `$env.FOO` in a Code
node throws `NodeOperationError: access to env vars denied` (even a plain Set node). asset-scan uses
**zero** `$env` (its S3/clamav config comes from credentials). To get config into a workflow:
- **Code node:** read raw **`process.env.FOO`** (works — it is not n8n's gated `$env`) with a dev
  fallback. Env vars must still be on the `n8n` compose service.
- **Secrets:** don't put them in code/JSON — carry them on a **credential**. e.g. the internal
  send-notification POST is an HTTP Request node with the `fnb-webhook-secret` httpHeaderAuth
  credential, not a `fetch` with a hand-set header.
- **Non-secret infra URLs:** hardcode in the node (dev) — the values are stable within a deployment.

**Code-node task-runner sandbox** (`N8N_RUNNERS_ENABLED=true`): **no global `URL`** (parse origins
with string ops), and `require()` of builtins needs `NODE_FUNCTION_ALLOW_BUILTIN` set on the n8n
service (we set `fs,http,https`). Outbound `http.request` from a Code node **does** work — the
sandbox restricts globals/require, not network. `process.env` and `require` are available; `$env`
and `URL` are not.

**`localhost` inside containers → `::1` (IPv6), but n8n listens IPv4-only** → `ECONNREFUSED ::1:5678`.
For an n8n self-call (workflow → its own webhook) use the **service name** `http://n8n:5678` (or
`127.0.0.1`), never `localhost`. Same gotcha the compose healthcheck documents (uses `127.0.0.1`).

**Iterating a workflow on a RUNNING n8n = three steps, in order:**
`n8n import:workflow --input=<file>` (this **deactivates** it) → `n8n publish:workflow --id=<id>`
(sets active=true) → **restart the container** (webhooks only register at startup). Skipping publish
leaves it inactive; skipping restart leaves the webhook unregistered (`404 … not registered`). The
workflow `id` comes from the JSON's top-level `id`. See [[rebuild-wipes-db]], [[n8n-hardened-image]].
