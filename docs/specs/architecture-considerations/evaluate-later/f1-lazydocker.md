# F1 — Lazydocker: Per-Service Log Viewer

## The Problem

`pnpm env-build` runs `docker compose up --build`, streaming all services into one terminal
with no way to isolate individual service logs.

## Lazydocker

A terminal UI (TUI) for Docker that requires zero project changes.

```bash
brew install lazydocker
lazydocker   # run in a separate terminal while docker compose is running
```

**Features:**
- Arrow keys to navigate between containers
- Per-service log stream — see only the service you care about
- Pause/scroll log history
- CPU and memory display per container
- No docker-compose.yml changes required

## vs. Dozzle (already in docker-compose.yml)

Dozzle is a web UI already added to `docker-compose.yml`, accessible at
http://localhost:8888. It has search, regex filtering, and color coding — better for
long sessions and debugging.

Lazydocker is better for quick ad-hoc log inspection without opening a browser.

## Recommendation

Use both:
- **Dozzle** for sustained debugging sessions (browser, searchable, always available with the stack)
- **Lazydocker** for quick terminal-based inspection (zero friction, no browser needed)

If only one: Lazydocker requires no project changes and works immediately.
