# fnb-auth

A pnpm + Turborepo monorepo.

## Apps
- `apps/fnb-auth-app` — Nuxt 4 application
- `apps/fnb-tenant-app` — Nuxt 4 application

## Packages
- `packages/fnb-auth-core` — Shared TypeScript utilities

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in dev mode |
| `pnpm build` | Build all packages and apps |
| `pnpm test` | Run all tests |
| `pnpm lint` | Lint all workspaces |
| `pnpm format` | Format all files with Prettier |

## Getting started

```bash
pnpm install
pnpm dev
```

Running the Docker stack on Linux or Windows? See [docs/cross-platform-setup.md](docs/cross-platform-setup.md) for per-OS setup (`FNB_PLATFORM`, WSL2, the portability checklist).
