# do-prod — thin environment: configure the provider + call the digitalocean module with prod knobs.
# Provider auth via env (never committed): DIGITALOCEAN_TOKEN, and SPACES_ACCESS_KEY_ID /
# SPACES_SECRET_ACCESS_KEY for the Spaces bucket resources.
provider "digitalocean" {}

module "digitalocean" {
  source = "../../modules/digitalocean"

  environment          = var.environment
  region               = var.region
  domain               = var.domain
  droplet_size         = var.droplet_size
  db_size              = var.db_size
  ssh_key_fingerprints = var.ssh_key_fingerprints
  admin_ssh_cidrs      = var.admin_ssh_cidrs
  enable_cdn           = var.enable_cdn
}

# The zitadel/n8n_engine DBs + roles + PostGIS are handled by the compose pg-bootstrap one-shot
# (default, OQ5). To let Terraform own that instead, configure a `postgresql` provider pointed at
# the cluster and add a `module "postgres_bootstrap"` here (see modules/postgres-bootstrap/README).
