# Cross-Platform Docker Compose

> **Execution Directive:** plan + build this spec via `/fnb-stack-implementor .claude/specs/cross-platform-compose/README.md` —
> the implementor derives the `.claude/issues/` plan file (R23) from the task list below, then executes it.

## Status

Draft — the dev `docker-compose.yml` is written for an Apple Silicon (macOS/arm64) host and
has host-specific assumptions baked in. This spec makes it portable to Linux (amd64 + arm64)
and Windows (WSL2) without changing the Mac experience.

## Purpose

Today `docker compose up` is validated only on the maintainer's Apple Silicon Mac. A new
contributor on Linux or Windows hits two hard failures and two soft ones:

| # | Symptom on a non-Mac host | Root cause |
|---|---|---|
| 1 | ARM Linux: `db`/`minio`/`clamav`/`n8n-db-init` boot under QEMU emulation (slow) or fail with `exec format error` if binfmt isn't registered | `platform: linux/amd64` hard-pinned on 5 services (`docker-compose.yml:26,115,137,160,601`) — added for Apple Silicon, now imposed on everyone |
| 2 | Windows: containers die immediately with `no such file or directory` on `#!/bin/sh` | 7 mounted/copied shell scripts get CRLF line endings from git (`core.autocrlf=true` default), which Linux `sh` cannot execute. No `.gitattributes` exists to force LF |
| 3 | Native-Windows-container mode: `dozzle` can't reach the daemon | `/var/run/docker.sock` bind mount (`docker-compose.yml:754`) — a unix path; native Windows uses a named pipe. (Fine under WSL2.) |
| 4 | Windows: painfully slow file watching / HMR misses | The `.:/app` bind mount is only fast when the repo lives *inside* the WSL2 filesystem, not on `/mnt/c` |

This spec resolves all four: #1 and #3 via env-var switches (native everywhere by default, Mac
opts back into amd64), #2 via a committed `.gitattributes`, and #4 via documented per-OS setup.

**Scope is the dev `docker-compose.yml` only.** `infra/compose/docker-compose.prod.yml` has no
platform pins and runs on Linux hosts — it is out of scope and left untouched.

## Locked decisions

| Decision | Choice | Why |
|---|---|---|
| Platform-pin default | **Native default, Mac opts in** — `platform: ${FNB_PLATFORM:-}` on all 5 services; empty string = Docker picks the host's native arch | Most portable: amd64 Linux/Windows and arm64 Linux all run native (fast, no emulation). Apple Silicon keeps today's behavior with a single `.env` line |
| Apple Silicon override | `FNB_PLATFORM=linux/amd64` set in `.env` on Mac only (documented in `.env.example`) | One switch controls all 5 pins together; matches the current amd64 behavior the Mac stack is validated against |
| `FNB_PLATFORM` is optional | Uses `${FNB_PLATFORM:-}` (empty default), **not** `${FNB_PLATFORM:?}` | Deliberate exception to the `.env.example` "every value required, fail-fast" rule — follows the existing `SENTRY_DSN:-` optional-var precedent. Empty = native is the safe default for the majority (Linux) case |
| Docker socket override | `dozzle` mounts `${DOCKER_SOCK:-/var/run/docker.sock}:/var/run/docker.sock` | Keeps the Mac/Linux/WSL2 default zero-config; lets a native-Windows or rootless-Docker user repoint the socket without editing compose |
| Windows support target | **WSL2 + Docker Desktop only**, repo cloned inside the WSL2 filesystem (`~/`, not `/mnt/c`) | The only sane way to run a Linux-container compose stack on Windows. Native Windows containers are not viable for this stack (musl/Alpine images, unix sockets, shell entrypoints) |
| `.gitattributes` strategy | Repo-wide `* text=auto eol=lf` + explicit `*.sh`/`*.mjs`/`Dockerfile`/`Caddyfile` `eol=lf` | Guarantees every container-executed script is LF regardless of the contributor's OS or git config. `eol=lf` (not just `text`) forces it even when `core.autocrlf=true` |
| Prod compose | Out of scope, untouched | No platform pins; already Linux-target |

## Files in this spec

| File | Change | Notes |
|---|---|---|
| `docker-compose.yml` | Edit | Replace 5 `platform: linux/amd64` → `platform: ${FNB_PLATFORM:-}`; `dozzle` socket → `${DOCKER_SOCK:-/var/run/docker.sock}:/var/run/docker.sock` |
| `.gitattributes` | **New** | Root-level LF enforcement (see Appendix A) |
| `.env.example` | Edit | New `# ─── Host platform (Apple Silicon only) ───` block documenting `FNB_PLATFORM` + optional `DOCKER_SOCK`, with the Mac-vs-rest guidance |
| `docs/cross-platform-setup.md` | **New** | Per-OS prerequisites + setup (macOS / Linux amd64 / Linux arm64 / Windows-WSL2) and the portability checklist (see Appendix B) |
| `README.md` (repo root) | Edit | Add a one-line pointer to `docs/cross-platform-setup.md` under the boot instructions |

**One-time action for the maintainer (Mac):** after `.gitattributes` lands, run
`git add --renormalize .` once so any already-committed CRLF blobs are normalized to LF in the
index. (Most files are already LF on this Mac-authored repo; this is a safety net, called out in
the plan as a manual step — never run by the implementor per the no-git rule.)

## Implementation Task List

### Phase 1 — Platform switch (fixes ARM Linux; no-op on amd64/Mac-with-override)
- [ ] Replace `platform: linux/amd64` with `platform: ${FNB_PLATFORM:-}` on all 5 services:
      `db` (26), `minio` (115), `minio-init` (137), `clamav` (160), `n8n-db-init` (601).
      Update the inline comments: `# host arch by default; Apple Silicon sets FNB_PLATFORM=linux/amd64 in .env`
- [ ] Add the `FNB_PLATFORM` block to `.env.example` (empty by default, Mac guidance inline)
- [ ] **Verify (Mac):** with `FNB_PLATFORM=linux/amd64` set, `docker compose up` behaves exactly as today

### Phase 2 — Line endings (fixes Windows)
- [ ] Add root `.gitattributes` (Appendix A)
- [ ] Confirm the 7 container-executed scripts are LF in the working tree
      (`file docker/**/*.sh infra/**/*.sh` — or `git check-attr eol -- <path>`)
- [ ] Note the maintainer's one-time `git add --renormalize .` in the plan (manual, human-run)

### Phase 3 — Docker socket override + docs
- [ ] `dozzle` socket mount → `${DOCKER_SOCK:-/var/run/docker.sock}:/var/run/docker.sock`
- [ ] Document `DOCKER_SOCK` (optional) in `.env.example`
- [ ] Write `docs/cross-platform-setup.md` (Appendix B): per-OS prerequisites, WSL2 repo-location
      warning, `FNB_PLATFORM` guidance, and the portability checklist
- [ ] Add the README pointer

### Phase 4 — Validation
- [ ] Full checklist run on macOS/arm64 (regression — must match today)
- [ ] Full checklist run on Linux/amd64 (`FNB_PLATFORM` unset → native)
- [ ] Best-effort checklist run on Windows 11 + WSL2 (repo inside the distro)
- [ ] (Optional / if hardware available) Linux/arm64 native run

## Remaining Open Questions

- **Does any of the 5 pinned images actually lack an arm64 variant?** `postgis/postgis`,
  `minio/minio`, `minio/mc`, and `clamav/clamav` all publish multi-arch tags today, so native
  arm64 *should* work — but this is unverified on real ARM hardware. If one turns out to be
  amd64-only, ARM Linux users set `FNB_PLATFORM=linux/amd64` (same escape hatch as Mac) and the
  spec still holds. Resolve during Phase 4.
- **Windows CI?** No Windows runner is proposed here — Windows support is documented + manually
  validated, not gated in CI. Revisit if Windows contributors become common.

## Considered & rejected

- **Keep `amd64` as the default (`${FNB_PLATFORM:-linux/amd64}`).** Rejected: forces emulation
  on every ARM Linux host and buries a Mac-specific choice as the global default. Native-default
  is more portable and Mac pays the one-line cost, since Mac is the minority host.
- **Per-service platform env vars** (`FNB_DB_PLATFORM`, `FNB_MINIO_PLATFORM`, …). Rejected:
  the 5 services are pinned for one reason (host arch), so one knob is correct. Over-parameterizing
  invites drift.
- **Native Windows container support** (named-pipe socket, path translation). Rejected: the stack
  is Alpine/musl Linux images with unix-socket and shell-script entrypoints — WSL2 is the only
  coherent Windows target. `DOCKER_SOCK` is still exposed for rootless/remote-daemon edge cases.
- **`:cached`/`:delegated` bind-mount flags for Mac perf.** Rejected: deprecated no-ops under
  VirtioFS (Docker Desktop's current file sharing); the `node_modules` named-volume overlays are
  already the effective mitigation.
- **Devcontainer / Vagrant to normalize the host.** Rejected as heavier than the problem — the
  four fixes here make the existing `docker compose up` flow portable without a new tool.

---

## Appendix A — `.gitattributes`

```gitattributes
# Normalize all text to LF in the repo. Critical: shell scripts and other files
# executed *inside* Linux containers must be LF — CRLF (Windows git default) makes
# `#!/bin/sh` fail with "no such file or directory" in the container.
* text=auto eol=lf

# Belt-and-suspenders for container-executed / interpreter files (force LF even if
# a contributor has core.autocrlf=true and the text=auto heuristic guesses wrong).
*.sh        text eol=lf
*.mjs       text eol=lf
*.ts        text eol=lf
*.js        text eol=lf
Dockerfile  text eol=lf
*.Dockerfile text eol=lf
Caddyfile   text eol=lf
*.sql       text eol=lf
*.conf      text eol=lf

# Binary assets — never touch line endings.
*.png binary
*.jpg binary
*.jpeg binary
*.webp binary
*.ico binary
*.zip binary
*.woff binary
*.woff2 binary
```

## Appendix B — `docs/cross-platform-setup.md` outline

1. **Prerequisites (all OSes):** Docker Desktop (or Docker Engine + Compose v2), git, `cp .env.example .env`.
2. **macOS (Apple Silicon):** set `FNB_PLATFORM=linux/amd64` in `.env` → the 5 infra images run
   amd64 under Rosetta/QEMU (the validated path). Intel Macs may leave it unset.
3. **Linux (amd64):** leave `FNB_PLATFORM` unset — everything runs native. Nothing else to do.
4. **Linux (arm64):** leave `FNB_PLATFORM` unset for native arm64. If any infra image fails to
   pull an arm64 tag, set `FNB_PLATFORM=linux/amd64` and ensure `binfmt`/QEMU is registered
   (`docker run --privileged --rm tonistiigi/binfmt --install all`).
5. **Windows 11 (WSL2):**
   - Install WSL2 + a distro (Ubuntu) + Docker Desktop with WSL2 backend.
   - **Clone the repo inside the WSL2 filesystem (`~/…`), NOT under `/mnt/c`** — bind-mount file
     watching (HMR) is slow/unreliable on `/mnt/c`.
   - Run all `docker compose`, `pnpm`, git commands from the WSL2 shell.
   - `FNB_PLATFORM` unset (WSL2 is amd64 on most Windows machines).
6. **Portability checklist** (run per host):
   - [ ] `docker compose up` reaches a healthy state (all healthchecks green)
   - [ ] `http://localhost:${PORT}/` loads (home-app)
   - [ ] Login via ZITADEL (`http://localhost:${ZITADEL_HOST_PORT}`) completes
   - [ ] n8n editor reachable (`http://localhost:${N8N_HOST_PORT}`); asset-scan workflow runs
   - [ ] An upload → scan → thumbnail round-trips (exercises minio + clamav + n8n Execute Command)
   - [ ] HMR: edit a `.vue` file, browser updates without a manual reload
   - [ ] Dozzle reachable (`http://localhost:${DOZZLE_PORT}`)
