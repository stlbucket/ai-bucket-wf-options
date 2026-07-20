terraform {
  # Env root pins `~>` to prevent surprise major bumps. `use_lockfile` (S3-native state locking)
  # needs Terraform >= 1.10; CI pins a recent CLI. (DynamoDB locking is deprecated —
  # references/state-and-backends.md.)
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}
