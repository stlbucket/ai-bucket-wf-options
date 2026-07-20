variable "environment" {
  type    = string
  default = "prod"
}

variable "region" {
  type    = string
  default = "nyc3"
}

variable "domain" {
  type        = string
  description = "Apex domain served over TLS."
}

variable "droplet_size" {
  type    = string
  default = "s-4vcpu-8gb"
}

variable "db_size" {
  type    = string
  default = "db-s-1vcpu-2gb"
}

variable "ssh_key_fingerprints" {
  type        = list(string)
  description = "DO SSH key fingerprints installed on the droplet."
  default     = []
}

variable "admin_ssh_cidrs" {
  type        = list(string)
  description = "CIDRs allowed to SSH (port 22)."
  default     = []
}

variable "enable_cdn" {
  type    = bool
  default = true
}
