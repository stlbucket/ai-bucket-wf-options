# Plan: Cross-platform dev `docker-compose.yml` — native-default platform, LF enforcement, socket override, per-OS docs

> **Execution Directive:** Implement this plan via `/fnb-stack-implementor <this-file>`.
> The authoritative spec is `.claude/specs/cross-platform-compose/README.md` — this plan sequences
> its Implementation Task List with verified code anchors and does not restate it (R21). No
> specialist skill is required (pure infra/compose/docs). **Never run `git`** (global no-git rule —
> the maintainer's `git add --renormalize .` and `.env` edits are human-only, flagged below).
> **Never rebuild/restart the env yourself — ask the user** (memory `feedback_rebuild_ask_user`),
> then verify read-only.

**Severity: LOW** (proactive portability enablement — nothing is broken for the current single-Mac
maintainer; the validated Mac path is preserved unchanged) · Workstream: infra · Planned: 2026-07-21
· Spec status: Draft, no `[FILL IN]`s, both Open Questions are Phase-4 field checks (deferred, not blocking).

## Context

The dev `docker-compose.yml` is validated only on Apple Silicon and bakes in host-specific
assumptions: `platform: linux/amd64` hard-pinned on 5 infra services (added for Rosetta on Mac),
no `.gitattributes` (Windows CRLF breaks `#!/bin/sh` entrypoints), and a hard-coded unix docker
socket for `dozzle`. This plan makes the stack portable to Linux (amd64 + arm64) and Windows
(WSL2) **without changing the Mac experience**, via: an env-var platform switch (native default,
Mac opts back into amd64), a committed `.gitattributes`, a `DOCKER_SOCK` override, and per-OS docs.

**Scope is the dev `docker-compose.yml` only.** `infra/compose/docker-compose.prod.yml` has no
platform pins and is Linux-target already — out of scope, untouched.

## Spec corrections found during planning (verified against source 2026-07-21)

1. **Stale line numbers in the spec.** The README cites `db (26)`, `minio (115)`, `minio-init
   (137)`, `clamav (160)`, `n8n-db-init (601)`, and dozzle socket `754`. The **actual** current
   anchors are:
   | Service | Real line | Current comment on the `platform:` line |
   |---|---|---|
   | `db` | **33** | none (bare `platform: linux/amd64`; it is a `build:` service → `image: fnb-db-pgtap:local`) |
   | `minio` | **125** | `# Apple Silicon: force amd64 (matches db service)` |
   | `minio-init` | **147** | `# Apple Silicon: force amd64 (matches db service)` |
   | `clamav` | **170** | `# Apple Silicon: force amd64 (matches db service)` |
   | `n8n-db-init` | **618** | none (bare `platform: linux/amd64`) |
   | `dozzle` socket | **771** | `- /var/run/docker.sock:/var/run/docker.sock` |
   Use these. (Line numbers shift as edits land top-to-bottom — edit by unique string match, not by
   line, and re-grep `platform:` / `docker.sock` after each edit to confirm 5→0 amd64 pins remain
   and the socket is parameterized.)
2. **Two of the five services have no inline comment today** (`db`, `n8n-db-init`). The spec's task
   says "update the inline comments" — for these two there is nothing to update, so **add** the new
   comment so all 5 read uniformly.
3. **Hidden manual maintainer step — this Mac's `.env`.** After the switch, `platform:
   ${FNB_PLATFORM:-}` defaults to **native**. On this Apple Silicon host the local `.env` (not
   `.env.example`, which I do edit) must gain `FNB_PLATFORM=linux/amd64` **before the next `docker
   compose up`**, or the 5 infra images will attempt native arm64 (behavior change / possible pull
   failure). `.env` is the user's file — I will **not** edit it; this is flagged as a human step in
   the Phase 1 verify gate.
4. **Root `README.md` is stale boilerplate** (titled `fnb-auth`, lists apps that no longer exist).
   The spec only asks for a one-line pointer under the boot instructions (`## Getting started`,
   L22) — do exactly that; a full README rewrite is out of scope (tracked separately under
   `0360__docs______claude-md-rewrite` territory if ever picked up).
5. **`docs/` already exists** (holds `gamestack.md`, `rough-db.png`) — `docs/cross-platform-setup.md`
   is a new file in it, no dir creation needed.
6. **7 container-executed shell scripts confirmed** (for the Phase-2 LF check):
   `docker/db-init/10-create-zitadel-db.sh`, `docker/migrate-entrypoint.sh`, `docker/n8n/db-init.sh`,
   `infra/docker/pg-bootstrap.sh`, `infra/scripts/{build-images,deploy,health-verify}.sh`.

## No rebuild required by the implementor

Every change here is config/docs (compose file, `.gitattributes`, `.env.example`, `docs/`, root
`README.md`). None of it mutates a running container. The compose + `.env` changes take effect only
on the maintainer's **next** `docker compose up`, which the user runs (not me). `.gitattributes`
affects git normalization only. So there is **no USER REBUILD GATE** in the feature sense — just the
read-only verifications below and the human-only git/`.env` steps.

## Implementation phases

Follows the spec README task list, enriched with verified anchors. Edit by unique string match.

### Phase 1 — Platform switch (fixes ARM Linux; no-op on amd64 / Mac-with-override)
- In `docker-compose.yml`, replace each of the 5 `platform: linux/amd64` lines with
  `platform: ${FNB_PLATFORM:-}` and set the trailing comment on all 5 to:
  `# host arch by default; Apple Silicon sets FNB_PLATFORM=linux/amd64 in .env`
  Services + real anchors per the correction table above (`db` 33, `minio` 125, `minio-init` 147,
  `clamav` 170, `n8n-db-init` 618). Re-grep `platform:` after → expect **zero** `linux/amd64`
  literals remaining.
- Add the `FNB_PLATFORM` block to `.env.example`. It is an **optional** var (`${FNB_PLATFORM:-}`,
  empty default) — a deliberate, spec-locked exception to the file's "EVERY value is REQUIRED"
  header rule, following the existing `SENTRY_DSN`/`ALPHA_VANTAGE_KEY` optional precedent. Place it
  in a dedicated block near the `# ─── Optional ───` section (currently ~L155). Suggested copy:
  ```dotenv
  # ─── Host platform (Apple Silicon only) ──────────────────────────────────────
  # Pins the 5 infra images (db, minio, minio-init, clamav, n8n-db-init) to one arch.
  # Empty/unset = Docker picks the host's NATIVE arch (correct for Linux amd64/arm64
  # and Windows-WSL2). Apple Silicon Macs MUST set linux/amd64 (Rosetta) — the
  # validated Mac path. Intel Macs may leave it unset.
  # FNB_PLATFORM=linux/amd64
  ```
- **Verify (Mac, human + read-only):** the maintainer adds `FNB_PLATFORM=linux/amd64` to their
  local `.env` (correction #3), then `docker compose up` behaves exactly as today. I confirm the
  compose file parses (`docker compose config -q`, read-only) and the 5 pins now interpolate.

### Phase 2 — Line endings (fixes Windows)
- Add root `.gitattributes` verbatim from spec **Appendix A** (repo-wide `* text=auto eol=lf` +
  explicit `*.sh` `*.mjs` `*.ts` `*.js` `Dockerfile` `*.Dockerfile` `Caddyfile` `*.sql` `*.conf`
  `eol=lf`, plus the binary-asset stanza). No `.gitattributes` exists today (verified) — this is a
  new file.
- Confirm the 7 container-executed scripts (correction #6) are already **LF** in the working tree
  (`file` on each, or `git check-attr eol -- <path>` — read-only, not a mutating git op). They are
  Mac-authored so should already be LF; this is the safety-net check the spec calls for.
- **Note the maintainer's one-time `git add --renormalize .`** in the hand-off (correction: this is
  a human-run git command — I never run it). It normalizes any already-committed CRLF blobs in the
  index once `.gitattributes` lands.

### Phase 3 — Docker socket override + docs
- `dozzle` socket mount (L771) → `${DOCKER_SOCK:-/var/run/docker.sock}:/var/run/docker.sock`.
  Zero-config for Mac/Linux/WSL2; lets a rootless/remote-daemon user repoint it without editing
  compose.
- Document `DOCKER_SOCK` (optional) in `.env.example` — one commented line in the same Optional
  region, e.g.:
  ```dotenv
  # Docker socket for the dozzle log viewer. Default suits Mac/Linux/WSL2; override
  # only for rootless or remote-daemon setups.
  # DOCKER_SOCK=/var/run/docker.sock
  ```
- Write `docs/cross-platform-setup.md` from spec **Appendix B** outline: prerequisites (all OSes),
  the four per-OS sections (macOS Apple Silicon / Linux amd64 / Linux arm64 / Windows-WSL2 with the
  "clone inside the WSL2 filesystem, not `/mnt/c`" warning), `FNB_PLATFORM` guidance, and the
  6-item portability checklist. Use the repo's real host-port env var names in the checklist
  (`PORT`, `ZITADEL_HOST_PORT`, `N8N_HOST_PORT`, `DOZZLE_PORT`) — cross-check the exact names
  against `.env.example` while writing so the doc doesn't ship stale placeholders.
- Add the one-line pointer to `docs/cross-platform-setup.md` in root `README.md` under
  `## Getting started` (L22). Do **not** rewrite the rest of that stale README (correction #4).

### Phase 4 — Validation (multi-host; mostly deferred — hardware-gated)
- **macOS/arm64 regression** — the only host available in this session. Confirm (read-only /
  human-run `up`) the stack matches today with `FNB_PLATFORM=linux/amd64` in `.env`.
- **Linux/amd64**, **Windows 11 + WSL2**, **Linux/arm64 native** — no such hardware here. These
  stay as documented, manually-validated checklist runs (spec's own stance: no Windows CI). Record
  them as **open, not done** in the hand-off — resolving the spec's two Open Questions (arm64 image
  availability; Windows CI) requires the real hardware and is out of this session's reach.

## Sequencing summary

1. All edits are independent files; do them in the Phase 1→3 order so `docker compose config -q`
   can validate after the compose edits. No codegen, no DB, no rebuild.
2. **Human touchpoints (not me):** (a) add `FNB_PLATFORM=linux/amd64` to the local `.env` on this
   Mac before the next `up`; (b) the one-time `git add --renormalize .` after `.gitattributes`
   lands; (c) any actual multi-host validation runs. All flagged in the completion hand-off.

## Out of scope / linked

- **`infra/compose/docker-compose.prod.yml`** — no platform pins, Linux-target; untouched (spec Locked decision).
- **Native Windows container support** — rejected in the spec (Alpine/musl + unix sockets + shell
  entrypoints); WSL2 is the only coherent Windows target. `DOCKER_SOCK` still exposed for
  rootless/remote edge cases.
- **Full root `README.md` rewrite** — the boilerplate is stale but out of scope here (pointer only).
- **arm64 image-availability + Windows-CI Open Questions** — Phase-4 field checks, hardware-gated,
  left open.
