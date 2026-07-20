variable "app_db" {
  type        = string
  description = "The application database (e.g. fnb) that gets the PostGIS extension."
  default     = "fnb"
}

variable "zitadel_db_password" {
  type        = string
  description = "Password for the zitadel owner login role."
  sensitive   = true
}

variable "n8n_engine_db_password" {
  type        = string
  description = "Password for the n8n_engine owner login role."
  sensitive   = true
}
