terraform {
  # Child module: state only a floor, no upper bound (a `~>` here would handcuff callers —
  # references/providers.md). 1.5.7 floor so the module validates on the local CLI.
  required_version = ">= 1.5.7"

  required_providers {
    postgresql = {
      source  = "cyrilgdn/postgresql"
      version = ">= 1.21"
    }
  }
}
