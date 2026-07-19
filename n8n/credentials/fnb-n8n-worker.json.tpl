{
  "id": "fnbn8nworkerpg01",
  "name": "fnb-n8n-worker",
  "type": "postgres",
  "data": {
    "host": "db",
    "port": 5432,
    "database": "${POSTGRES_DB}",
    "user": "n8n_worker",
    "password": "${N8N_WORKER_PG_PASSWORD}",
    "ssl": "disable",
    "allowUnauthorizedCerts": false
  }
}
