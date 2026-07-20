# aws-prod — thin environment: configure the provider + call the aws module with prod knobs.
# Provider auth in CI via GitHub OIDC assume-role (no static keys — spec §4/§6); locally via the
# usual AWS credential chain (profile / env).
provider "aws" {
  region = var.region
}

module "aws" {
  source = "../../modules/aws"

  environment       = var.environment
  region            = var.region
  domain            = var.domain
  instance_type     = var.instance_type
  db_instance_class = var.db_instance_class
  key_name          = var.key_name
  admin_ssh_cidrs   = var.admin_ssh_cidrs
  enable_cdn        = var.enable_cdn
  db_username       = var.db_username
  db_password       = var.db_password
}

# PostGIS + the zitadel/n8n_engine DBs/roles are handled by the compose pg-bootstrap one-shot on the
# EC2 box (OQ5) — RDS is in a private subnet with no inbound path for a Terraform postgresql
# provider from CI. To use the TF-native path instead, run it from the box (see
# modules/postgres-bootstrap/README).
