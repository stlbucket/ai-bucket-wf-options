# aws-prod non-secret knobs. Passed with `-var-file=aws-prod.tfvars`.
# db_password is a SECRET — supply it as TF_VAR_db_password from the secret store, NOT here.
# Fill placeholders before the first apply.

environment       = "prod"
region            = "us-east-1"   # OQ2
domain            = "example.com" # OQ1 — delegate its NS to the Route 53 zone this creates
instance_type     = "t3.xlarge"   # OQ8
db_instance_class = "db.t3.medium"
enable_cdn        = false # OQ6 — CloudFront (default cert) if true

# EC2 key pair name (must already exist in the region). Empty = no SSH key.
key_name = ""

# CIDRs allowed to SSH. Empty = no inbound SSH rule.
admin_ssh_cidrs = []
