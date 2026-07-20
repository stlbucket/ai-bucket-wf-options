# Outputs = the contract to infra/env/render-env.mjs (via `terraform output -json`).
# NOTE: unlike DO, the PG password is user-supplied (secret store), so it is NOT re-output here —
# render-env gets MANAGED_PG_ADMIN_PASSWORD / APP_PG_PASSWORD from the secret store on AWS.

output "eip" {
  description = "Elastic IP (DNS A records point here)."
  value       = aws_eip.web.public_ip
}

output "domain" {
  description = "Apex domain (passthrough)."
  value       = var.domain
}

output "route53_name_servers" {
  description = "Delegate the domain's registrar NS records to these."
  value       = aws_route53_zone.main.name_servers
}

# ── Managed Postgres (RDS) ───────────────────────────────────────────────────
output "pg_host" {
  description = "MANAGED_PG_HOST — RDS endpoint address."
  value       = aws_db_instance.pg.address
}

output "pg_port" {
  description = "MANAGED_PG_PORT."
  value       = aws_db_instance.pg.port
}

output "pg_admin_user" {
  description = "MANAGED_PG_ADMIN_USER (RDS master)."
  value       = aws_db_instance.pg.username
}

output "pg_admin_db" {
  description = "MANAGED_PG_ADMIN_DB — the initial database to connect for CREATE DATABASE (= app DB)."
  value       = aws_db_instance.pg.db_name
}

output "app_pg_user" {
  description = "APP_PG_USER (RDS master for now — see superuser-database-url.plan.md)."
  value       = aws_db_instance.pg.username
}

# ── Object storage (S3) ──────────────────────────────────────────────────────
output "s3_endpoint" {
  description = "S3_ENDPOINT — regional S3 endpoint (OQ4: non-empty so requiredEnv is satisfied)."
  value       = "https://s3.${var.region}.amazonaws.com"
}

output "s3_region" {
  description = "S3_REGION."
  value       = var.region
}

output "s3_bucket" {
  description = "S3_BUCKET."
  value       = aws_s3_bucket.assets.bucket
}

output "s3_public_base_url" {
  description = "S3_PUBLIC_BASE_URL — CloudFront domain when enabled, else the S3 virtual-hosted origin."
  value       = var.enable_cdn ? "https://${aws_cloudfront_distribution.assets[0].domain_name}" : "https://${aws_s3_bucket.assets.bucket_regional_domain_name}"
}

# ── Registry ─────────────────────────────────────────────────────────────────
output "registry_endpoint" {
  description = "REGISTRY — ECR registry host (<acct>.dkr.ecr.<region>.amazonaws.com)."
  value       = local.registry_host
}

output "ecr_repository_urls" {
  description = "Per-app ECR repository URLs."
  value       = { for k, r in aws_ecr_repository.app : k => r.repository_url }
}
