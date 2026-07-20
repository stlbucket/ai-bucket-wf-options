# postgres-bootstrap — the Terraform-native alternative to infra/docker/pg-bootstrap.sh: create the
# zitadel + n8n_engine databases + owner login roles + PostGIS on the app DB, via the
# cyrilgdn/postgresql provider (spec production-runtime.md §7).
#
# The provider CONFIGURATION (host/port/admin creds) is supplied by the calling ENVIRONMENT root
# and inherited here — this module only declares the resources. The provider needs a NETWORK PATH
# to the managed cluster at plan/apply time, which is the hurdle the deployment spec flags on AWS
# (env-aws.md §2 / OQ5) — hence the DEFAULT wired mechanism is the on-box compose one-shot, and this
# module is the opt-in TF-native path. `terraform validate` does NOT connect, so this validates
# offline; a real apply needs the cluster reachable + admin creds in the provider config.
#
# NOTE: on DigitalOcean the zitadel/n8n_engine databases + users are ALSO creatable natively
# (digitalocean_database_db / _user) — that path lets DO manage the passwords and output them. If
# you use this module on DO instead, do not also declare them natively (pick one owner).

resource "postgresql_role" "zitadel" {
  name     = "zitadel"
  login    = true
  password = var.zitadel_db_password
}

resource "postgresql_role" "n8n_engine" {
  name     = "n8n_engine"
  login    = true
  password = var.n8n_engine_db_password
}

resource "postgresql_database" "zitadel" {
  name  = "zitadel"
  owner = postgresql_role.zitadel.name
}

resource "postgresql_database" "n8n_engine" {
  name  = "n8n_engine"
  owner = postgresql_role.n8n_engine.name
}

# PostGIS on the app DB (loc module needs it). `database` targets the app DB specifically; the
# extension is available in both DO Managed PG and RDS under the managed admin role.
resource "postgresql_extension" "postgis" {
  name     = "postgis"
  database = var.app_db
}
