terraform {
  # Env root pins with `~>` to prevent surprise major provider bumps (references/providers.md).
  # The DO Spaces backend `endpoints {}` form needs Terraform >= 1.6; CI pins a recent CLI.
  required_version = ">= 1.6"

  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.34"
    }
  }
}
