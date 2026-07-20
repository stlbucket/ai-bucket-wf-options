output "databases" {
  description = "Names of the bootstrapped databases."
  value       = [postgresql_database.zitadel.name, postgresql_database.n8n_engine.name]
}

output "roles" {
  description = "Names of the bootstrapped owner login roles."
  value       = [postgresql_role.zitadel.name, postgresql_role.n8n_engine.name]
}
