#!/usr/bin/env bash
# Zap Komunick: backup of the database and of the files (attachments, media and
# WhatsApp sessions). Run from the repository root on the server:
#   ./deploy/backup.sh            -> backups/AAAA-MM-DD-HHMM/
# Keeps the last 14 backups. Schedule it in cron, e.g. every day at 3h:
#   0 3 * * * cd /opt/zap-komunick && ./deploy/backup.sh >> backups/backup.log 2>&1
set -euo pipefail

COMPOSE="docker compose -f docker-compose-komunick.yaml"
STAMP=$(date +%Y-%m-%d-%H%M)
DEST="backups/$STAMP"
KEEP=${KEEP:-14}

mkdir -p "$DEST"

# shellcheck disable=SC1091
set -a; [ -f .env ] && . ./.env; set +a

$COMPOSE exec -T postgres pg_dump -U "${POSTGRES_USER:-ticketz}" -d "${POSTGRES_DB:-ticketz}" \
  --no-owner | gzip > "$DEST/banco.sql.gz"

# files of the backend (public = media and attachments, private = sessions)
$COMPOSE run --rm --no-deps -T --entrypoint sh \
  -v "$(pwd)/$DEST:/backup" backend \
  -c "tar czf /backup/arquivos.tar.gz -C /usr/src/app public private"

ls -1d backups/20* 2>/dev/null | sort | head -n -"$KEEP" | xargs -r rm -rf

echo "backup pronto em $DEST"
