# do-prod non-secret knobs. Passed with `-var-file=do-prod.tfvars`.
# Secrets (none here) arrive as TF_VAR_* from the secret store — never commit secrets to a tfvars.
# Fill in the placeholders below before the first apply.

environment  = "prod"
region       = "nyc3"                # OQ2 — pick your DO region (drives Spaces endpoint + droplet locality)
domain       = "function-bucket.net" # OQ1 — apex is canonical; www 301s to it (Caddyfile)
droplet_size = "s-4vcpu-8gb"         # OQ8 — memory pressure: 8 apps + ZITADEL + n8n + ClamAV
db_size      = "db-s-1vcpu-2gb"
enable_cdn   = true # OQ6

# DO SSH key fingerprints installed on the droplet (from `doctl compute ssh-key list`).
ssh_key_fingerprints = ["75:14:12:e9:bd:f4:97:44:70:f1:64:1b:d1:6d:cc:22"] # fnb-prod

# CIDRs allowed to SSH (lock to your admin IPs). Empty = no inbound SSH rule.
# T-Mobile CGNAT egress block (exact IP rotates); widen/re-apply if a rotation lands outside it.
admin_ssh_cidrs = ["172.56.0.0/16"]
