variable "environment" {
  type        = string
  description = "Deploy environment; suffixes every named resource so envs never collide."
  default     = "prod"
  validation {
    condition     = contains(["prod", "staging"], var.environment)
    error_message = "environment must be prod or staging."
  }
}

variable "region" {
  type        = string
  description = "DO region slug (droplet + Spaces + PG locality), e.g. nyc3."
}

variable "domain" {
  type        = string
  description = "Apex domain served over TLS (e.g. example.com). id.<domain> + n8n.<domain> derive from it."
}

variable "subdomain_id" {
  type        = string
  description = "ZITADEL issuer subdomain label."
  default     = "id"
}

variable "subdomain_n8n" {
  type        = string
  description = "n8n editor/webhook subdomain label."
  default     = "n8n"
}

variable "droplet_size" {
  type        = string
  description = "Droplet size slug. 8 Node apps + ZITADEL + n8n + ClamAV are memory-hungry."
  default     = "s-4vcpu-8gb"
}

variable "droplet_image" {
  type        = string
  description = "Droplet base image slug."
  default     = "ubuntu-24-04-x64"
}

variable "ssh_key_fingerprints" {
  type        = list(string)
  description = "Fingerprints of DO SSH keys to install on the droplet (admin access)."
  default     = []
}

variable "admin_ssh_cidrs" {
  type        = list(string)
  description = "CIDRs allowed to SSH (port 22). Everything else on 22 is blocked."
  default     = []
}

variable "db_size" {
  type        = string
  description = "Managed PG node size slug."
  default     = "db-s-1vcpu-2gb"
}

variable "db_node_count" {
  type        = number
  description = "Managed PG node count (1 = single node; raise for HA)."
  default     = 1
}

variable "pg_version" {
  type        = string
  description = "Managed PG major version."
  default     = "16"
}

variable "app_db_name" {
  type        = string
  description = "Application database created in the cluster (sqitch target)."
  default     = "fnb"
}

variable "bucket_name" {
  type        = string
  description = "Spaces bucket name. Empty = derive fnb-assets-<environment>."
  default     = ""
}

variable "enable_cdn" {
  type        = bool
  description = "Front the Spaces bucket with the DO CDN endpoint (drives S3_PUBLIC_BASE_URL)."
  default     = true
}

variable "registry_name" {
  type        = string
  description = "DOCR registry name (globally unique). Empty = derive fnb-<environment>."
  default     = ""
}

variable "quarantine_expire_days" {
  type        = number
  description = "Lifecycle expiry for quarantine/* objects (matches the dev mc ilm rule)."
  default     = 7
}
