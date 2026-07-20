# Re-export module outputs for `terraform output -json` → render-env.mjs.
output "eip" { value = module.aws.eip }
output "domain" { value = module.aws.domain }
output "route53_name_servers" { value = module.aws.route53_name_servers }

output "pg_host" { value = module.aws.pg_host }
output "pg_port" { value = module.aws.pg_port }
output "pg_admin_user" { value = module.aws.pg_admin_user }
output "pg_admin_db" { value = module.aws.pg_admin_db }
output "app_pg_user" { value = module.aws.app_pg_user }

output "s3_endpoint" { value = module.aws.s3_endpoint }
output "s3_region" { value = module.aws.s3_region }
output "s3_bucket" { value = module.aws.s3_bucket }
output "s3_public_base_url" { value = module.aws.s3_public_base_url }

output "registry_endpoint" { value = module.aws.registry_endpoint }
output "ecr_repository_urls" { value = module.aws.ecr_repository_urls }
