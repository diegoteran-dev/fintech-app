#!/bin/bash
# Start n8n locally via Docker (data persisted at ~/.n8n)
# Run once: the container has --restart unless-stopped so it auto-starts with Docker

if docker ps --filter "name=vault-n8n" --format "{{.Names}}" | grep -q vault-n8n; then
  echo "vault-n8n is already running at http://localhost:5678"
  exit 0
fi

if docker ps -a --filter "name=vault-n8n" --format "{{.Names}}" | grep -q vault-n8n; then
  echo "Starting existing vault-n8n container..."
  docker start vault-n8n
else
  echo "Creating vault-n8n container..."
  docker run -d \
    --name vault-n8n \
    --restart unless-stopped \
    -p 5678:5678 \
    -v ~/.n8n:/home/node/.n8n \
    -e GENERIC_TIMEZONE="America/Chicago" \
    -e N8N_SECURE_COOKIE=false \
    n8nio/n8n
fi

sleep 5
curl -s http://localhost:5678/healthz && echo ""
echo "n8n running at http://localhost:5678"
echo "Login: diego.teran.a@gmail.com"
