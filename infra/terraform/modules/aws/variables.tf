variable "environment" {
  type        = string
  description = "Deploy environment; suffixes every named resource."
  default     = "prod"
  validation {
    condition     = contains(["prod", "staging"], var.environment)
    error_message = "environment must be prod or staging."
  }
}

variable "region" {
  type        = string
  description = "AWS region, e.g. us-east-1."
}

variable "domain" {
  type        = string
  description = "Apex domain served over TLS. id.<domain> + n8n.<domain> derive from it."
}

variable "subdomain_id" {
  type    = string
  default = "id"
}

variable "subdomain_n8n" {
  type    = string
  default = "n8n"
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "instance_type" {
  type        = string
  description = "EC2 size. Same memory pressure as the DO droplet (8 apps + ZITADEL + n8n + ClamAV)."
  default     = "t3.xlarge"
}

variable "key_name" {
  type        = string
  description = "EC2 key pair name for SSH (must already exist in the region). Empty = no key."
  default     = ""
}

variable "admin_ssh_cidrs" {
  type        = list(string)
  description = "CIDRs allowed to SSH (port 22)."
  default     = []
}

variable "db_instance_class" {
  type    = string
  default = "db.t3.medium"
}

variable "db_allocated_storage" {
  type    = number
  default = 20
}

variable "pg_version" {
  type    = string
  default = "16"
}

variable "app_db_name" {
  type        = string
  description = "RDS initial database (the sqitch target)."
  default     = "fnb"
}

variable "db_username" {
  type        = string
  description = "RDS master username (the managed admin; not a true superuser)."
  default     = "fnbadmin"
}

variable "db_password" {
  type        = string
  description = "RDS master password (from the secret store via TF_VAR_db_password). In state — keep the backend encrypted."
  sensitive   = true
}

variable "bucket_name" {
  type        = string
  description = "S3 bucket name. Empty = derive fnb-assets-<environment>."
  default     = ""
}

variable "enable_cdn" {
  type        = bool
  description = "Front S3 with CloudFront (default cert). Off = direct S3 object URLs."
  default     = false
}

variable "quarantine_expire_days" {
  type    = number
  default = 7
}

variable "app_images" {
  type        = list(string)
  description = "ECR repository names (one per app image)."
  default = [
    "fnb-auth-app", "fnb-home-app", "fnb-tenant-app", "fnb-msg-app",
    "fnb-game-app", "fnb-graphql-api-app", "fnb-storage-app",
    # TODO (plan 0010): add "fnb-n8n" once the custom n8n image is built + pushed (asset-scan).
  ]
}
