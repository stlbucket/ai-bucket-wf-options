# Cross-platform dev setup

The dev `docker compose up` stack runs on macOS, Linux (amd64 + arm64), and Windows (WSL2). The
only host-specific knob is **`FNB_PLATFORM`** — everything else is identical across hosts.

> Spec: `.claude/specs/cross-platform-compose/README.md`. Scope is the **dev** `docker-compose.yml`;
> `infra/compose/docker-compose.prod.yml` is Linux-target and unaffected.

## Prerequisites (all OSes)

- **Docker** — Docker Desktop, or Docker Engine + Compose v2 (`docker compose`, not the legacy
  `docker-compose`).
- **git** — with the committed root `.gitattributes` in place, line endings normalize to LF
  automatically; no per-user `core.autocrlf` change is needed.
- **Copy the env file:** `cp .env.example .env`, then fill in the required values (every value is
  required unless the comment marks it optional).

## macOS (Apple Silicon)

Set **`FNB_PLATFORM=linux/amd64`** in `.env`. The five infra images (`db`, `minio`, `minio-init`,
`clamav`, `n8n-db-init`) then run amd64 under Rosetta/QEMU — the validated Mac path.

Intel Macs are native amd64 and may leave `FNB_PLATFORM` unset.

## Linux (amd64)

Leave **`FNB_PLATFORM` unset** — everything runs native. Nothing else to do.

## Linux (arm64)

Leave **`FNB_PLATFORM` unset** for native arm64 (`postgis/postgis`, `minio/minio`, `minio/mc`, and
`clamav/clamav` all publish multi-arch tags).

If any infra image fails to pull an arm64 tag, fall back to amd64 emulation: set
**`FNB_PLATFORM=linux/amd64`** and register QEMU/binfmt once:

```bash
docker run --privileged --rm tonistiigi/binfmt --install all
```

## Windows 11 (WSL2)

WSL2 + Docker Desktop is the **only** supported Windows path (the stack is Alpine/musl Linux images
with unix-socket and shell-script entrypoints; native Windows containers are not viable).

1. Install WSL2 + a Linux distro (Ubuntu) + Docker Desktop with the **WSL2 backend** enabled.
2. **Clone the repo _inside_ the WSL2 filesystem (`~/…`), NOT under `/mnt/c`.** Bind-mount file
   watching (HMR) is slow and unreliable on `/mnt/c`; inside the distro it is fast.
3. Run all `docker compose`, `pnpm`, and `git` commands from the **WSL2 shell**, not PowerShell.
4. Leave **`FNB_PLATFORM` unset** — WSL2 is amd64 on most Windows machines, so images run native.

## `FNB_PLATFORM` at a glance

| Host | `FNB_PLATFORM` |
|---|---|
| macOS Apple Silicon | `linux/amd64` (required) |
| macOS Intel | unset |
| Linux amd64 | unset |
| Linux arm64 | unset (fallback `linux/amd64` + binfmt if an image lacks arm64) |
| Windows 11 (WSL2) | unset |

`FNB_PLATFORM` is optional (`${FNB_PLATFORM:-}`, empty = native) — a deliberate exception to the
`.env.example` "every value required" rule, so the Linux/WSL2 majority boots with zero config.

For rootless or remote Docker daemons, `DOCKER_SOCK` (optional) repoints the `dozzle` log viewer's
socket mount without editing compose.

## Portability checklist (run per host)

- [ ] `docker compose up` reaches a healthy state (all healthchecks green)
- [ ] `http://localhost:${PORT}/` loads (home-app)
- [ ] Login via ZITADEL (`http://localhost:${ZITADEL_HOST_PORT}`) completes
- [ ] n8n editor reachable (`http://localhost:${N8N_HOST_PORT}`); the asset-scan workflow runs
- [ ] An upload → scan → thumbnail round-trips (exercises minio + clamav + n8n Execute Command)
- [ ] HMR: edit a `.vue` file, the browser updates without a manual reload
- [ ] Dozzle reachable (`http://localhost:${DOZZLE_PORT}`)
