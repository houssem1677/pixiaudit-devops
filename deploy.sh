#!/usr/bin/env bash

set -Eeuo pipefail

PROJECT="pixiaudit-deploy"
COMPOSE_FILE="docker-compose.deploy.yml"
ENV_FILE=".env.deploy"

echo "==> Checking deployment files"

for file in \
  "$COMPOSE_FILE" \
  "$ENV_FILE" \
  "secrets/postgres_password.txt" \
  "secrets/jwt_secret.txt" \
  "secrets/smtp_password.txt"
do
  if [[ ! -f "$file" ]]; then
    echo "Missing required file: $file"
    exit 1
  fi
done

echo "==> Validating Docker Compose configuration"

docker compose \
  --project-name "$PROJECT" \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  config --quiet

echo "==> Pulling GHCR images"

docker compose \
  --project-name "$PROJECT" \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  pull

echo "==> Starting PixiAudit deployment"

docker compose \
  --project-name "$PROJECT" \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  up -d

echo "==> Deployment containers"

docker compose \
  --project-name "$PROJECT" \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  ps

echo "==> Deployment command completed."
echo "Check container health before considering the deployment successful."
