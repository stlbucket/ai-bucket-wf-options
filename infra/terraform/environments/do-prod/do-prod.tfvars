# do-prod non-secret knobs. Passed with `-var-file=do-prod.tfvars`.
# Secrets (none here) arrive as TF_VAR_* from the secret store — never commit secrets to a tfvars.
# Fill in the placeholders below before the first apply.

environment  = "prod"
region       = "nyc3"        # OQ2 — pick your DO region (drives Spaces endpoint + droplet locality)
domain       = "example.com" # OQ1 — your real apex domain (delegate its NS to DO)
droplet_size = "s-4vcpu-8gb" # OQ8 — memory pressure: 8 apps + ZITADEL + n8n + ClamAV
db_size      = "db-s-1vcpu-2gb"
enable_cdn   = true # OQ6

# DO SSH key fingerprints installed on the droplet (from `doctl compute ssh-key list`).
ssh_key_fingerprints = []

# CIDRs allowed to SSH (lock to your admin IPs). Empty = no inbound SSH rule.
admin_ssh_cidrs = []
