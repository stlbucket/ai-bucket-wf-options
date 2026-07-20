terraform {
  # Remote state on S3 with native lockfile (no DynamoDB). Per-environment key — never shared.
  # Create the state bucket + enable versioning + default encryption once, before the first init.
  # CI auth via GitHub OIDC assume-role (no static keys — spec §4/§6).
  backend "s3" {
    bucket       = "fnb-tfstate"
    key          = "aws-prod/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}
