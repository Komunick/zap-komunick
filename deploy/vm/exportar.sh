#!/usr/bin/env bash
# Empacota um ambiente do SuperChat para restaurar em outra VM. Roda na VM de ORIGEM.
#   exportar.sh AMBIENTE DESTINO            copia com o sistema no ar (ensaio)
#   exportar.sh AMBIENTE DESTINO --final    PARA o ambiente e faz a copia definitiva
# AMBIENTE: production ou development. Nao apaga nada. So depende do Docker e do openssl,
# para funcionar tambem numa VM instalada antes deste pacote.
set -euo pipefail
umask 077
[ "$(id -u)" = 0 ] || { echo "rode com sudo" >&2; exit 1; }
[ $# -ge 2 ] || { echo "uso: $0 production|development DESTINO [--final]" >&2; exit 2; }
ambiente=$1 destino=$2 modo=${3:-}
[[ "$modo" = "" || "$modo" = --final ]] || { echo "opcao desconhecida: $modo" >&2; exit 2; }
case "$ambiente" in
  production) proj=superchat ;;
  development) proj=superchatdev ;;
  *) echo "ambiente invalido" >&2; exit 2 ;;
esac
ROOT=${ZAPK_ROOT:-/opt/zap-komunick}
cur=$(readlink -f "$ROOT/$proj/current" || true)
[ -f "$cur/.env" ] && [ -f "$cur/.env-backend" ] || { echo "$proj sem release corrente em $ROOT" >&2; exit 1; }
[ ! -e "$destino" ] || { echo "o destino ja existe: $destino" >&2; exit 1; }
valor() { sed -n "s/^$1=//p" "$cur/.env" | head -1; }
[ "$(valor COMPOSE_PROJECT_NAME)" = "$proj" ] && [ "$(valor ZK_ENVIRONMENT)" = "$ambiente" ] || { echo ".env nao corresponde ao ambiente" >&2; exit 1; }
rev=$(valor ZK_REVISION)
[[ "$rev" =~ ^[0-9a-f]{40}$ ]] || { echo "revisao invalida no .env" >&2; exit 1; }
C=(docker compose --project-directory "$cur" --env-file "$cur/.env" -f "$cur/compose.yaml")

livre=$(df -Pk "$(dirname -- "$destino")" | awk 'NR==2{print $4}')
usado=0
for v in postgres_data redis_data backend_public backend_private; do
  usado=$((usado + $(du -sk "$(docker volume inspect -f '{{.Mountpoint}}' "${proj}_$v")" | cut -f1)))
done
[ "$livre" -gt $((usado * 2)) ] || { echo "pouco disco: ${livre}K livres para ${usado}K de dados" >&2; exit 1; }

if [ "$modo" = --final ]; then
  echo "A copia FINAL para o ambiente $proj: ninguem usa o sistema ate a outra VM subir."
  read -r -p "Digite 'parar $proj' para continuar: " resposta </dev/tty
  [ "$resposta" = "parar $proj" ] || { echo "cancelado, nada foi parado" >&2; exit 1; }
  # O poller religaria a homologacao parada.
  systemctl disable --now zapk-poller.timer >/dev/null 2>&1 || true
  "${C[@]}" stop -t 60 frontend backend
  # sem o backend nao ha escrita; o Redis grava tudo ao parar
  "${C[@]}" stop -t 60 redis
fi

mkdir -p -- "$destino"; destino=$(cd -- "$destino" && pwd -P)
imagem=$(docker inspect -f '{{.Image}}' "$(docker ps -aq --filter "label=com.docker.compose.project=$proj" --filter label=com.docker.compose.service=postgres | head -1)")
sql() { "${C[@]}" exec -T postgres sh -c 'exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -v ON_ERROR_STOP=1' ; }

echo "banco..."
"${C[@]}" exec -T postgres sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges' | gzip > "$destino/banco.sql.gz"
echo "arquivos..."
docker run --rm --network none -v "${proj}_backend_public:/d/public:ro" -v "${proj}_backend_private:/d/private:ro" \
  --entrypoint tar "$imagem" czf - -C /d public private > "$destino/arquivos.tar.gz"
echo "redis..."
docker run --rm --network none -v "${proj}_redis_data:/d:ro" --entrypoint tar "$imagem" czf - -C /d . > "$destino/redis.tar.gz"
gzip -t "$destino/"{banco.sql,arquivos.tar,redis.tar}.gz

echo "segredos (senha do pacote; guarde-a fora do pacote)..."
cifrar=(openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt -out "$destino/segredos.enc")
[ -n "${ZAPK_PASS_FILE:-}" ] && cifrar+=(-pass "file:$ZAPK_PASS_FILE")
tar cf - -C "$cur" .env .env-backend | "${cifrar[@]}"

{
  echo "formato=1"
  echo "ambiente=$ambiente"
  echo "projeto=$proj"
  echo "revisao=$rev"
  echo "final=$([ "$modo" = --final ] && echo sim || echo nao)"
  echo "data=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "origem=$(hostname -s)"
  for t in Companies Users Contacts Tickets Messages Whatsapps BaileysKeys SequelizeMeta; do
    echo "linhas_$t=$(echo "select count(*) from \"$t\";" | sql)"
  done
  echo "arquivos=$(tar tzf "$destino/arquivos.tar.gz" | grep -vc '/$' || true)"
} > "$destino/MANIFESTO"
( cd "$destino" && sha256sum banco.sql.gz arquivos.tar.gz redis.tar.gz segredos.enc MANIFESTO > SHA256SUMS )
chmod 600 "$destino"/*
cat "$destino/MANIFESTO"
du -sh "$destino"
echo "Pacote pronto em $destino. Contem dados de clientes: copie so por SSH e apague ao final."
