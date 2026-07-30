# Self-Hosting — Compose, Configuration, Proxying, Production

## Docker Compose quick start

Official stack: **Traefik → ZITADEL API (Go, :8080) + ZITADEL Login v2 (Next.js, :3000) → PostgreSQL**. Traefik handles all routing including gRPC/h2c automatically. Grab `docker-compose.yml` + `.env.example` from the zitadel repo, copy to `.env`, then `docker compose up -d --wait`.

Key `.env` values: `ZITADEL_DOMAIN` (public domain), `ZITADEL_MASTERKEY` (**exactly 32 chars**), `ZITADEL_EXTERNALSECURE=true` for HTTPS, `ZITADEL_EXTERNALPORT` (usually 443), `POSTGRES_ADMIN_PASSWORD`, `POSTGRES_ZITADEL_PASSWORD`.

First login: `http://localhost:8080` (or your domain) as `zitadel-admin@zitadel.localhost` / `Password1!` — change immediately.

**The masterkey cannot be changed after initialization** without losing access to encrypted data. Generate (`tr -dc A-Za-z0-9 </dev/urandom | head -c 32`) and store it *before* first start.

## Configuration model

- Runtime config = YAML (`defaults.yaml` documents everything) passed via `--config`; first-instance seeding via `--steps`.
- **Every YAML key maps to an env var**: `ZITADEL_` + uppercase path with `_` separators. `Database.postgres.Host` → `ZITADEL_DATABASE_POSTGRES_HOST`; `TLS.Enabled` → `ZITADEL_TLS_ENABLED`; `ExternalSecure` → `ZITADEL_EXTERNALSECURE`. Env overrides file.
- Masterkey delivery: `ZITADEL_MASTERKEY` env (with `--masterkeyFromEnv`), `ZITADEL_MASTERKEY_PATH` file, or `--masterkey` flag.

Core settings: `Port` (internal, default 8080), `ExternalDomain`, `ExternalPort`, `ExternalSecure`, `TLS.Enabled`/`TLS.KeyPath`/`TLS.CertPath`.

Database:

```yaml
Database:
  postgres:
    Host: localhost
    Port: 5432
    Database: zitadel
    User: { Username: zitadel, Password: "..." }   # runtime user
    Admin: { Username: postgres, Password: "..." } # only for init
```

## FirstInstance / steps seeding

Override `DefaultInstance` in the steps file to seed org name, admin human, and — critical for IaC — a **machine user with a key and/or PAT** so automation can hit the APIs from t=0:

```yaml
DefaultInstance:
  Org:
    Name: MyOrg
    Human:
      UserName: zitadel-admin
      FirstName: ZITADEL
      LastName: Admin
      Email: { Address: admin@example.com, Verified: true }
      Password: "Password1!"
    Machine:
      Machine: { Username: automation, Name: Automation }
      MachineKey: { ExpirationDate: "2027-01-01T00:00:00Z", Type: 1 }  # 1 = JSON key
      Pat: { ExpirationDate: "2027-01-01T00:00:00Z" }
```

The generated key/PAT are written where your deployment can read them (compose volumes / k8s secrets per the official templates).

## Run phases

`zitadel init` (create DB/user/schema — needs Admin creds) → `zitadel setup` (migrations/projections + steps) → `zitadel start`. Shortcuts: `start-from-init`, `start-from-setup`. For HA, run init/setup once (job) and have workload replicas run plain `start`.

## Reverse proxy — the two rules

1. **h2c upstream**: ZITADEL serves gRPC + HTTP on one HTTP/2 port. A TLS-terminating proxy must forward **unencrypted HTTP/2 (h2c)**, not HTTP/1.1, or gRPC (Console, SDKs) breaks. nginx: `grpc_pass grpc://zitadel:8080` for gRPC paths / HTTP2-capable upstream config; Traefik/Caddy handle it natively.
2. **Forward the original `Host` header** — ZITADEL matches it against `ExternalDomain` to build the issuer; a mismatched Host yields instance-not-found errors.

TLS modes: `disabled` (plain, dev), `external` (proxy terminates TLS — the standard production mode; set `ExternalSecure: true`, `ExternalPort: 443`), `enabled` (ZITADEL terminates TLS itself).

Routing with login v2: `/ui/v2/login` → login container (:3000), everything else → zitadel (:8080). Documented proxy guides: Traefik, NGINX, Caddy, Apache httpd, Cloudflare (+Tunnel).

## Production checklist

- **HA**: orchestrator (k8s) with multiple `start` replicas; init/setup as separate jobs.
- **DB**: PostgreSQL; pool defaults MaxOpenConns 10 / MaxIdleConns 5 / MaxConnLifetime 30m / MaxConnIdleTime 5m. Event-sourced: full state reconstructable from `eventstore.events` — back up the DB.
- **Sizing**: ZITADEL ~512MB / <1 core baseline; password hashing spikes CPU (plan ~4 cores); DB ~1 core per 100 req/s, 4GB/core. Minimal HA: 3 nodes × 4 cores × 16GB.
- **Observability**: metrics at `/debug/metrics` (OpenTelemetry); tracing `otel`/`google`/`log`; LogStore for access/execution logs.
- Secrets: masterkey + DB creds via secret manager; never bake into images.
- Also review: custom domain setup, rate limits, and the updating/scaling guides under `zitadel.com/docs/self-hosting/manage/*`.
