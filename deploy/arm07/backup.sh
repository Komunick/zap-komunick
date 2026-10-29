#!/usr/bin/env bash
# Backup privado sem apagar backups antigos nem incluir arquivos de ambiente.
set -euo pipefail
umask 077
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
destination=${1:-"$root/backups/$(date -u +%Y%m%dT%H%M%SZ)"}
[[ ! -e "$destination" && ! -L "$destination" ]] || { printf 'Destino de backup ja existe.\n' >&2; exit 1; }
mkdir -p -- "$destination"
chmod 700 -- "$destination"
destination=$(cd -- "$destination" && pwd -P)
compose=(docker compose --project-directory "$root" --env-file "$root/.env" -f "$root/compose.yaml")

"${compose[@]}" exec -T postgres sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner' | gzip > "$destination/banco.sql.gz"
"${compose[@]}" exec -T backend tar czf - -C /usr/src/app public private > "$destination/arquivos.tar.gz"
gzip -t "$destination/banco.sql.gz" "$destination/arquivos.tar.gz"
(
    cd -- "$destination"
    sha256sum banco.sql.gz arquivos.tar.gz > SHA256SUMS
)
chmod 600 -- "$destination/banco.sql.gz" "$destination/arquivos.tar.gz" "$destination/SHA256SUMS"
printf 'Backup concluido em %s. Master/ambiente devem permanecer em cofre separado.\n' "$destination"
