terraform {
  # Remote state on DigitalOcean Spaces (S3-compatible). Per-environment key — never shared across
  # environments (references/state-and-backends.md). Credentials (the Spaces key/secret) come via
  # AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY env vars, NOT this block.
  #
  # Create the state bucket + enable versioning once, out of band, before the first `init`.
  # Fill bucket/region to your Spaces state bucket (or pass via `-backend-config` at init).
  backend "s3" {
    bucket = "fnb-tfstate-do"
    key    = "do-prod/terraform.tfstate"
    region = "nyc3" # Spaces region name

    endpoints                   = { s3 = "https://nyc3.digitaloceanspaces.com" }
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_metadata_api_check     = true
    skip_requesting_account_id  = true
    skip_s3_checksum            = true
    use_path_style              = true
    # Native S3 lockfile support on Spaces is uneven — rely on CI serializing applies (one at a
    # time) as the practical lock; enable use_lockfile only after verifying it works on Spaces.
  }
}
