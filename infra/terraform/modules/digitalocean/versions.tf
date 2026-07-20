terraform {
  # Child module: floor only, no `~>` upper bound (don't handcuff callers — references/providers.md).
  required_version = ">= 1.5.7"

  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = ">= 2.34"
    }
  }
}
