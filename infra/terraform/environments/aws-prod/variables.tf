variable "environment" {
  type    = string
  default = "prod"
}

variable "region" {
  type    = string
  default = "us-east-1"
}

variable "domain" {
  type        = string
  description = "Apex domain served over TLS."
}

variable "instance_type" {
  type    = string
  default = "t3.xlarge"
}

variable "db_instance_class" {
  type    = string
  default = "db.t3.medium"
}

variable "key_name" {
  type        = string
  description = "EC2 key pair name (must exist in the region)."
  default     = ""
}

variable "admin_ssh_cidrs" {
  type    = list(string)
  default = []
}

variable "enable_cdn" {
  type    = bool
  default = false
}

variable "db_username" {
  type    = string
  default = "fnbadmin"
}

variable "db_password" {
  type        = string
  description = "RDS master password — supply via TF_VAR_db_password from the secret store; never commit."
  sensitive   = true
}
