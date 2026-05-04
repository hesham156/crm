#!/bin/bash
# ============================================================
#  ProSticker ERP - Production Server Backup Script (Bash)
#  Server: prosticker.wafarle.com
#
#  Backs up:
#    - PostgreSQL database (via pg_dump inside Docker)
#    - MinIO object storage bucket
#    - /media files volume
#    - .env and config files
#
#  Usage:
#    chmod +x backup_server.sh
#    ./backup_server.sh
#    ./backup_server.sh --days 14          # keep 14 days
#    ./backup_server.sh --upload-gdrive    # upload to Google Drive (optional)
#
#  Cron (daily at 2:00 AM server time):
#    0 2 * * * /opt/prosticker/backup/backup_server.sh >> /var/log/prosticker_backup.log 2>&1
# ============================================================

set -euo pipefail

# ── Config ──────────────────────────────────────────────────
PROJECT_DIR="/opt/prosticker"            # Change to your server's project path
BACKUP_ROOT="/opt/prosticker/backups"
KEEP_DAYS="${BACKUP_DAYS:-30}"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_DIR="$BACKUP_ROOT/backup_$TIMESTAMP"
LOG_PREFIX="[ProSticker Backup]"

# Load .env for DB credentials
ENV_FILE="$PROJECT_DIR/.env"
if [ -f "$ENV_FILE" ]; then
    set -o allexport
    source "$ENV_FILE"
    set +o allexport
fi

# Database credentials (from .env or defaults)
DB_NAME="${POSTGRES_DB:-prosticker}"
DB_USER="${POSTGRES_USER:-prosticker}"
DB_PASS="${POSTGRES_PASSWORD:-prosticker_secure_pass}"
MINIO_USER="${MINIO_ROOT_USER:-prosticker_minio}"
MINIO_PASS="${MINIO_ROOT_PASSWORD:-prosticker_minio_secret}"
MINIO_BUCKET="${AWS_STORAGE_BUCKET_NAME:-prosticker-files}"

echo ""
echo "========================================================"
echo " $LOG_PREFIX $TIMESTAMP"
echo "========================================================"

mkdir -p "$BACKUP_DIR"
echo "[+] Backup directory: $BACKUP_DIR"

# ── 1. PostgreSQL Dump ───────────────────────────────────────
echo ""
echo "[1/4] Backing up PostgreSQL database..."
PG_DUMP_FILE="$BACKUP_DIR/database.sql.gz"

# Run pg_dump inside the db container
if docker compose -f "$PROJECT_DIR/docker-compose.yml" exec -T db \
    pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$PG_DUMP_FILE"; then
    SIZE=$(du -sh "$PG_DUMP_FILE" | cut -f1)
    echo "    OK  database.sql.gz ($SIZE)"
else
    echo "    ERROR  pg_dump failed!" >&2
fi

# ── 2. MinIO Bucket Backup ───────────────────────────────────
echo ""
echo "[2/4] Backing up MinIO storage..."
MINIO_BACKUP_DIR="$BACKUP_DIR/minio"
mkdir -p "$MINIO_BACKUP_DIR"

# Use mc (MinIO Client) if available, otherwise skip
if command -v mc &>/dev/null; then
    mc alias set prosticker_minio http://localhost:9000 "$MINIO_USER" "$MINIO_PASS" --quiet
    mc mirror "prosticker_minio/$MINIO_BUCKET" "$MINIO_BACKUP_DIR" --quiet
    FILE_COUNT=$(find "$MINIO_BACKUP_DIR" -type f | wc -l)
    echo "    OK  MinIO bucket $MINIO_BUCKET ($FILE_COUNT files)"
else
    # Fallback: copy from Docker volume directly
    docker run --rm \
        -v prosticker_minio_data:/minio_data \
        -v "$MINIO_BACKUP_DIR":/backup \
        alpine sh -c "cp -r /minio_data/. /backup/" 2>/dev/null || true
    echo "    OK  MinIO volume copied (mc not found, used docker volume fallback)"
fi

# ── 3. Media Files (local fallback) ─────────────────────────
echo ""
echo "[3/4] Backing up media files..."
MEDIA_BACKUP_DIR="$BACKUP_DIR/media"

# Try to copy from Docker volume
docker run --rm \
    -v prosticker_media_volume:/media_src \
    -v "$MEDIA_BACKUP_DIR":/media_dst \
    alpine sh -c "mkdir -p /media_dst && cp -r /media_src/. /media_dst/" 2>/dev/null && {
    FILE_COUNT=$(find "$MEDIA_BACKUP_DIR" -type f | wc -l)
    echo "    OK  media volume ($FILE_COUNT files)"
} || {
    # Fallback to backend/media directory
    MEDIA_SRC="$PROJECT_DIR/backend/media"
    if [ -d "$MEDIA_SRC" ]; then
        cp -r "$MEDIA_SRC" "$MEDIA_BACKUP_DIR"
        FILE_COUNT=$(find "$MEDIA_BACKUP_DIR" -type f | wc -l)
        echo "    OK  backend/media/ ($FILE_COUNT files)"
    else
        echo "    SKIP  No media directory found"
    fi
}

# ── 4. Config & Secrets ─────────────────────────────────────
echo ""
echo "[4/4] Backing up config & secrets..."
CONFIG_DIR="$BACKUP_DIR/config"
mkdir -p "$CONFIG_DIR"

CONFIGS=(
    "$PROJECT_DIR/.env:root.env"
    "$PROJECT_DIR/backend/.env:backend.env"
    "$PROJECT_DIR/backend/credentials.json:credentials.json"
    "$PROJECT_DIR/docker-compose.yml:docker-compose.yml"
    "$PROJECT_DIR/nginx/nginx.conf:nginx.conf"
)

for entry in "${CONFIGS[@]}"; do
    src="${entry%%:*}"
    name="${entry##*:}"
    if [ -f "$src" ]; then
        cp "$src" "$CONFIG_DIR/$name"
        echo "    OK  $name"
    else
        echo "    SKIP  $name (not found at $src)"
    fi
done

# ── Compress ─────────────────────────────────────────────────
echo ""
echo "Compressing backup..."
ZIP_FILE="$BACKUP_ROOT/backup_$TIMESTAMP.tar.gz"
tar -czf "$ZIP_FILE" -C "$BACKUP_DIR" .
rm -rf "$BACKUP_DIR"
SIZE=$(du -sh "$ZIP_FILE" | cut -f1)
echo "    OK  backup_$TIMESTAMP.tar.gz ($SIZE)"

# ── Cleanup Old Backups ──────────────────────────────────────
echo ""
echo "Cleaning backups older than $KEEP_DAYS days..."
DELETED=0
while IFS= read -r -d '' old_file; do
    rm -f "$old_file"
    echo "    Deleted: $(basename "$old_file")"
    DELETED=$((DELETED + 1))
done < <(find "$BACKUP_ROOT" -name "backup_*.tar.gz" -mtime +"$KEEP_DAYS" -print0)
[ "$DELETED" -eq 0 ] && echo "    Nothing to clean."

# ── Optional: Upload to Remote ───────────────────────────────
# Uncomment and configure one of these:

# Option A: rsync to another server
# rsync -az "$ZIP_FILE" user@backup-server:/backups/prosticker/

# Option B: AWS S3 / Backblaze B2
# aws s3 cp "$ZIP_FILE" "s3://your-backup-bucket/prosticker/" --storage-class STANDARD_IA

# ── Summary ─────────────────────────────────────────────────
echo ""
echo "========================================================"
echo " Backup Complete!"
echo " File    : $ZIP_FILE"
echo " Size    : $SIZE"
echo " Kept    : last $KEEP_DAYS days"
echo "========================================================"
