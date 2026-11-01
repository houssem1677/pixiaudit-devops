#!/usr/bin/env bash
set -Eeuo pipefail

CONTAINER="pixiaudit-deploy-postgres-1"
BACKUP_DIR="$HOME/pixiaudit-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/pixiaudit_${TIMESTAMP}.dump"
TEMP_FILE="${BACKUP_FILE}.tmp"

umask 077
mkdir -p "$BACKUP_DIR"

cleanup() {
    rm -f "$TEMP_FILE"
}
trap cleanup EXIT

echo "Starting PixiAudit PostgreSQL backup..."

# Create a compressed custom-format backup.
docker exec "$CONTAINER" sh -c \
    'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
    > "$TEMP_FILE"

# Verify that PostgreSQL can read the archive.
docker exec -i "$CONTAINER" pg_restore --list \
    < "$TEMP_FILE" > /dev/null

# Publish the backup only after successful verification.
mv "$TEMP_FILE" "$BACKUP_FILE"

echo "Backup verified: $BACKUP_FILE"

# Remove backups older than seven days.
find "$BACKUP_DIR" -maxdepth 1 -type f \
    -name 'pixiaudit_*.dump' -mtime +7 -delete

echo "Backup completed successfully."
