# Re-export the module outputs so `terraform output -json` at the env level feeds render-env.mjs.
output "reserved_ip" { value = module.digitalocean.reserved_ip }
output "domain" { value = module.digitalocean.domain }

output "pg_host" { value = module.digitalocean.pg_host }
output "pg_port" { value = module.digitalocean.pg_port }
output "pg_admin_user" { value = module.digitalocean.pg_admin_user }
output "pg_admin_password" {
  value     = module.digitalocean.pg_admin_password
  sensitive = true
}
output "pg_admin_db" { value = module.digitalocean.pg_admin_db }
output "app_pg_user" { value = module.digitalocean.app_pg_user }
output "app_pg_password" {
  value     = module.digitalocean.app_pg_password
  sensitive = true
}

output "s3_endpoint" { value = module.digitalocean.s3_endpoint }
output "s3_region" { value = module.digitalocean.s3_region }
output "s3_bucket" { value = module.digitalocean.s3_bucket }
output "s3_public_base_url" { value = module.digitalocean.s3_public_base_url }

output "registry_endpoint" { value = module.digitalocean.registry_endpoint }
