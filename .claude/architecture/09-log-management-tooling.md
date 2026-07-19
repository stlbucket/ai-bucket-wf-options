# Log Management for `pnpm env-build`

## Problem

`pnpm env-build` runs `docker compose up --build`, streaming logs from 9 services into a single terminal window:

- `db` — PostgreSQL startup
- `db-migrate` — Sqitch migration runner (one-shot)
- `pnpm-install` — Root dependency install (one-shot)
- `packages-watch` — Package builds (logging suppressed already)
- `auth-app`, `tenant-app`, `home-app`, `msg-app` — Four Nuxt dev servers
- `nginx` — Reverse proxy

One-shot setup services intermix with persistent app logs; no way to isolate a single service or filter by level.

---

## Options

### Option A — Lazydocker (TUI, no project changes)

`brew install lazydocker`, run in a second terminal alongside `env-build`.

- Navigate containers with arrow keys, drill into per-service logs
- Filter, pause/scroll, tail any single service
- Shows CPU/memory alongside logs
- **Pro:** Zero project changes, works immediately
- **Con:** Separate terminal, not embedded in the workflow

### Option B — Dozzle (Web UI, add to docker-compose)

Add a `dozzle` service to `docker-compose.yml`:

```yaml
dozzle:
  image: amir20/dozzle:latest
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock
  ports:
    - "8888:8080"
  environment:
    DOZZLE_FILTER: "name=fnb"
  networks:
    - fnb-network
```

Visit `http://localhost:8888` — per-container log streams, search, regex filter, color-coded.

- **Pro:** Always available with the stack, great UX, searchable
- **Con:** Small docker-compose edit, mounts Docker socket

### Option C — Docker Desktop (already installed, no changes)

Docker Desktop → Containers → click any container for its log stream.

- **Pro:** Zero effort
- **Con:** GUI only, no real filtering, can't view multiple streams side-by-side

---

## Recommendation

**Lazydocker + Dozzle together** — Lazydocker for terminal-native quick tailing, Dozzle as a persistent service for searchable log history.

If only one: **Lazydocker** — zero friction, available immediately.

---

## Implementation

**File to modify:** `docker-compose.yml` — add the `dozzle` service block above at the end of `services:`. No other files change.

After `pnpm env-build`, open `http://localhost:8888` for Dozzle alongside the normal `http://localhost:<PORT>` nginx entry point.
