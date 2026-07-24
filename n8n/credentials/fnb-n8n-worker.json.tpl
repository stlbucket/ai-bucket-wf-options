{
  "id": "fnbn8nworkerpg01",
  "name": "fnb-n8n-worker",
  "type": "postgres",
  "data": {
    "host": "${N8N_WORKER_PG_HOST}",
    "port": ${N8N_WORKER_PG_PORT},
    "database": "${POSTGRES_DB}",
    "user": "n8n_worker",
    "password": "${N8N_WORKER_PG_PASSWORD}",
    "ssl": "${N8N_WORKER_PG_SSL}",
    "allowUnauthorizedCerts": ${N8N_WORKER_PG_ALLOW_UNAUTHORIZED_CERTS}
  }
}
