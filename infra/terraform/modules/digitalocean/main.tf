# DigitalOcean environment (spec environment-digitalocean.md §2): one droplet running the prod
# Compose stack, backed by Managed PG + Spaces, over a private VPC. Caddy fronts TLS; n8n/zitadel
# are reached THROUGH Caddy (their raw ports stay closed on the cloud firewall).
#
# Naming: every resource is suffixed with var.environment so prod/staging never collide.
# Provider auth: DIGITALOCEAN_TOKEN (+ Spaces spaces_access_id/spaces_secret_key) via env — never
# committed. App-runtime Spaces creds (S3_ACCESS_KEY/S3_SECRET_KEY) come from the secret store,
# not created here (spec §4).

locals {
  name          = "fnb-${var.environment}"
  bucket        = var.bucket_name != "" ? var.bucket_name : "fnb-assets-${var.environment}"
  registry_name = var.registry_name != "" ? var.registry_name : "fnb-${var.environment}"
  fqdn_id       = "${var.subdomain_id}.${var.domain}"
  fqdn_n8n      = "${var.subdomain_n8n}.${var.domain}"
}

# ── Private network ──────────────────────────────────────────────────────────
resource "digitalocean_vpc" "main" {
  name   = local.name
  region = var.region
}

# ── Droplet (Compose host) ───────────────────────────────────────────────────
resource "digitalocean_droplet" "web" {
  name      = local.name
  region    = var.region
  size      = var.droplet_size
  image     = var.droplet_image
  vpc_uuid  = digitalocean_vpc.main.id
  ssh_keys  = var.ssh_key_fingerprints
  user_data = file("${path.module}/cloud-init.yaml")
  tags      = [local.name]
}

# Stable public IP across droplet rebuilds; DNS points here.
resource "digitalocean_reserved_ip" "web" {
  region     = var.region
  droplet_id = digitalocean_droplet.web.id
}

# ── Managed Postgres (PostGIS available; private-network host) ────────────────
resource "digitalocean_database_cluster" "pg" {
  name                 = local.name
  engine               = "pg"
  version              = var.pg_version
  size                 = var.db_size
  region               = var.region
  node_count           = var.db_node_count
  private_network_uuid = digitalocean_vpc.main.id
}

# App database (sqitch target). The zitadel + n8n_engine databases are created by the compose
# pg-bootstrap one-shot instead — DO's database_db can't set an OWNER, and those two need owner
# roles (spec §7). This keeps DB ownership correct + the bootstrap uniform across clouds.
resource "digitalocean_database_db" "fnb" {
  cluster_id = digitalocean_database_cluster.pg.id
  name       = var.app_db_name
}

# Only the droplet may reach the cluster.
resource "digitalocean_database_firewall" "pg" {
  cluster_id = digitalocean_database_cluster.pg.id
  rule {
    type  = "droplet"
    value = digitalocean_droplet.web.id
  }
}

# ── Spaces (S3-compatible object storage) ────────────────────────────────────
resource "digitalocean_spaces_bucket" "assets" {
  name   = local.bucket
  region = var.region
  acl    = "private"

  # Replaces the dev `mc ilm` rule: quarantine/* expires after N days.
  lifecycle_rule {
    prefix  = "quarantine/"
    enabled = true
    expiration {
      days = var.quarantine_expire_days
    }
  }

  # Browser uploads (mirrors the storage-app upload flow).
  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "HEAD"]
    allowed_origins = ["https://${var.domain}"]
    max_age_seconds = 3600
  }
}

# Anonymous read on public/* only (replaces `mc anonymous set download …/public`).
resource "digitalocean_spaces_bucket_policy" "assets" {
  region = var.region
  bucket = digitalocean_spaces_bucket.assets.name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "PublicReadPublicPrefix"
      Effect    = "Allow"
      Principal = "*"
      Action    = ["s3:GetObject"]
      Resource  = ["arn:aws:s3:::${digitalocean_spaces_bucket.assets.name}/public/*"]
    }]
  })
}

# Optional CDN in front of the bucket → S3_PUBLIC_BASE_URL origin.
resource "digitalocean_cdn" "assets" {
  count  = var.enable_cdn ? 1 : 0
  origin = digitalocean_spaces_bucket.assets.bucket_domain_name
}

# ── Container registry (the droplet pulls app images from here) ───────────────
resource "digitalocean_container_registry" "registry" {
  name                   = local.registry_name
  subscription_tier_slug = "basic"
  region                 = var.region
}

# ── Cloud firewall: 80/443 open, 22 admin-only, everything else closed ────────
resource "digitalocean_firewall" "web" {
  name        = local.name
  droplet_ids = [digitalocean_droplet.web.id]

  inbound_rule {
    protocol         = "tcp"
    port_range       = "80"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }
  inbound_rule {
    protocol         = "tcp"
    port_range       = "443"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }
  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = var.admin_ssh_cidrs
  }

  outbound_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
  outbound_rule {
    protocol              = "udp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
  outbound_rule {
    protocol              = "icmp"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}

# ── DNS: apex + id. + n8n. → the reserved IP ─────────────────────────────────
# The domain must be delegated to DO nameservers (registrar NS records) — the user's one-time step.
resource "digitalocean_domain" "main" {
  name = var.domain
}

resource "digitalocean_record" "root" {
  domain = digitalocean_domain.main.id
  type   = "A"
  name   = "@"
  value  = digitalocean_reserved_ip.web.ip_address
  ttl    = 300
}

resource "digitalocean_record" "id" {
  domain = digitalocean_domain.main.id
  type   = "A"
  name   = var.subdomain_id
  value  = digitalocean_reserved_ip.web.ip_address
  ttl    = 300
}

resource "digitalocean_record" "n8n" {
  domain = digitalocean_domain.main.id
  type   = "A"
  name   = var.subdomain_n8n
  value  = digitalocean_reserved_ip.web.ip_address
  ttl    = 300
}
