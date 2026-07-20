# Outputs are the contract to infra/env/render-env.mjs (consumed via `terraform output -json`).
# Names align with the render-env leaf variables where practical.

output "reserved_ip" {
  description = "Stable public IP (DNS A records point here)."
  value       = digitalocean_reserved_ip.web.ip_address
}

output "domain" {
  description = "Apex domain (passthrough for render-env DOMAIN)."
  value       = var.domain
}

# ── Managed Postgres ── the box reaches the cluster over the VPC private host ──
output "pg_host" {
  description = "MANAGED_PG_HOST — private (VPC) host reachable from the droplet."
  value       = digitalocean_database_cluster.pg.private_host
}

output "pg_port" {
  description = "MANAGED_PG_PORT."
  value       = digitalocean_database_cluster.pg.port
}

output "pg_admin_user" {
  description = "MANAGED_PG_ADMIN_USER (doadmin — not a true superuser)."
  value       = digitalocean_database_cluster.pg.user
}

output "pg_admin_password" {
  description = "MANAGED_PG_ADMIN_PASSWORD."
  value       = digitalocean_database_cluster.pg.password
  sensitive   = true
}

output "pg_admin_db" {
  description = "MANAGED_PG_ADMIN_DB — maintenance db to connect for CREATE DATABASE (defaultdb)."
  value       = digitalocean_database_cluster.pg.database
}

# App connection. For now this is doadmin (parity with the dev superuser DATABASE_URL — the scoped
# role downgrade is tracked in superuser-database-url.plan.md; spec §7 Note). Swap to a scoped user
# when that lands.
output "app_pg_user" {
  description = "APP_PG_USER (doadmin for now — see superuser-database-url.plan.md)."
  value       = digitalocean_database_cluster.pg.user
}

output "app_pg_password" {
  description = "APP_PG_PASSWORD."
  value       = digitalocean_database_cluster.pg.password
  sensitive   = true
}

# ── Object storage (Spaces) ──────────────────────────────────────────────────
output "s3_endpoint" {
  description = "S3_ENDPOINT — Spaces regional endpoint."
  value       = "https://${var.region}.digitaloceanspaces.com"
}

output "s3_region" {
  description = "S3_REGION."
  value       = var.region
}

output "s3_bucket" {
  description = "S3_BUCKET."
  value       = digitalocean_spaces_bucket.assets.name
}

# Browser-reachable base for public/ objects. Virtual-hosted style (S3_FORCE_PATH_STYLE=false), so
# the app appends the object KEY directly (no bucket path segment). CONFIRM the app's public-URL
# construction at first deploy (graphql-api-app/server/lib/s3.ts derives origin from this).
output "s3_public_base_url" {
  description = "S3_PUBLIC_BASE_URL — CDN endpoint when enabled, else the bucket origin."
  value       = var.enable_cdn ? "https://${digitalocean_cdn.assets[0].endpoint}" : "https://${digitalocean_spaces_bucket.assets.bucket_domain_name}"
}

# ── Registry ─────────────────────────────────────────────────────────────────
output "registry_endpoint" {
  description = "REGISTRY — DOCR endpoint (registry.digitalocean.com/<name>)."
  value       = digitalocean_container_registry.registry.endpoint
}
