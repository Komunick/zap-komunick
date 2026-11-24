#!/usr/bin/env bash
# Restaura um pacote de exportar.sh. Roda na VM de DESTINO, depois de instalar.sh.
#   importar.sh AMBIENTE PACOTE --ensaio      projeto separado, sem dominio, sem WhatsApp
#   importar.sh AMBIENTE PACOTE --definitivo  ambiente real (exige pacote final)
#   importar.sh AMBIENTE --remover-ensaio     apaga somente o ensaio
# Nunca sobrescreve um ambiente existente.
set -euo pipefail
umask 077
[ "$(id -u)" = 0 ] || { echo "rode com sudo" >&2; exit 1; }
ACTION=importar
# shellcheck source=common.sh
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)/common.sh"
carregar_host
uso() { echo "uso: $0 production|development PACOTE --ensaio|--definitivo | AMBIENTE --remover-ensaio" >&2; exit 2; }
[ $# -ge 2 ] || uso
ambiente=$1
perfil "$ambiente"
base=$proj
travar || fail "ja existe um deploy em andamento"

if [ "$2" = --remover-ensaio ]; then
  proj=${base}ensaio
  [ -f "$ROOT/$proj/current/ENSAIO" ] || fail "nao ha ensaio de $base"
  compose "$proj" --profile ops down -v --remove-orphans
  rm -rf -- "${ROOT:?}/$proj"
  log "ensaio de $base removido"
  exit 0
fi
[ $# = 3 ] || uso
pacote=$(cd -- "$2" && pwd -P); modo=$3
[[ "$modo" = --ensaio || "$modo" = --definitivo ]] || uso

( cd "$pacote" && sha256sum --quiet -c SHA256SUMS ) || fail "pacote corrompido"
m() { sed -n "s/^$1=//p" "$pacote/MANIFESTO" | head -1; }
[ "$(m formato)" = 1 ] && [ "$(m ambiente)" = "$ambiente" ] && [ "$(m projeto)" = "$base" ] || fail "pacote de outro ambiente"
rev=$(m revisao)
[[ "$rev" =~ ^[0-9a-f]{40}$ ]] || fail "revisao invalida no pacote"

if [ "$modo" = --definitivo ]; then
  [ "$(m final)" = sim ] || fail "o pacote nao e final: a origem continuou gravando depois da copia"
  echo "Dois SuperChats com a mesma sessao de WhatsApp derrubam um ao outro."
  read -r -p "A origem ($(m origem)) esta PARADA? Digite 'origem parada': " resposta </dev/tty
  [ "$resposta" = "origem parada" ] || fail "cancelado"
else
  proj=${base}ensaio
fi

[ ! -e "$ROOT/$proj" ] || fail "$ROOT/$proj ja existe"
[ -z "$(docker volume ls -q --filter "label=com.docker.compose.project=$proj")" ] || fail "ja existem volumes do projeto $proj"
[ -z "$(docker ps -aq --filter "label=com.docker.compose.project=$proj")" ] || fail "ja existem conteineres do projeto $proj"

prepare_export "$rev"
build_frontend "$rev" "$ambiente"

dir=$ROOT/$proj/releases/$rev
mkdir -p "$dir"; chmod 700 "$dir"
abrir=(openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in "$pacote/segredos.enc")
[ -n "${ZAPK_PASS_FILE:-}" ] && abrir+=(-pass "file:$ZAPK_PASS_FILE")
"${abrir[@]}" | tar xf - -C "$dir" --no-same-owner .env .env-backend || { rm -rf -- "${ROOT:?}/$proj"; fail "senha do pacote incorreta"; }
chmod 600 "$dir/.env" "$dir/.env-backend"

if [ "$modo" = --ensaio ]; then
  : > "$dir/ENSAIO"
  n=240; porta=5495; [ "$ambiente" = development ] && { n=242; porta=5496; }
  definir "$dir/.env" ZK_PERFIL_TRUST_PROXY "$(valor "$dir/.env" ZK_FRONTEND_INTERNAL_IP)/32"
  definir "$dir/.env" COMPOSE_PROJECT_NAME "$proj"
  definir "$dir/.env" ZK_HTTP_PORT "$porta"
  definir "$dir/.env" ZK_EDGE_SUBNET "172.29.$n.0/28"
  definir "$dir/.env" ZK_EDGE_GATEWAY "172.29.$n.1"
  definir "$dir/.env" ZK_FRONTEND_EDGE_IP "172.29.$n.10"
  definir "$dir/.env" ZK_INTERNAL_SUBNET "172.29.$((n + 1)).0/28"
  definir "$dir/.env" ZK_FRONTEND_INTERNAL_IP "172.29.$((n + 1)).10"
  definir "$dir/.env" ZK_BACKEND_INTERNAL_IP "172.29.$((n + 1)).11"
  definir "$dir/.env" ZK_POSTGRES_INTERNAL_IP "172.29.$((n + 1)).12"
  definir "$dir/.env" ZK_REDIS_INTERNAL_IP "172.29.$((n + 1)).13"
fi
preparar_release "$dir" "$rev" "$ambiente"
ln -sfn "$dir" "$ROOT/$proj/current"

imagem=$(valor "$dir/.env" ZK_BACKEND_IMAGE)
restaurar() { # VOLUME(S) montados em /d, tar do stdin
  docker run --rm -i --network none --user 0:0 "$@" --entrypoint tar "$imagem" xzf - -C /d --numeric-owner
}
log "criando $proj em ${rev:0:8}"
compose "$proj" create --pull never postgres redis >>"$LOG" 2>&1 || fail "criar postgres/redis"
# O ensaio nao recebe a fila: agendamentos e campanhas nao devem rodar nele.
[ "$modo" = --ensaio ] || restaurar -v "${proj}_redis_data:/d" < "$pacote/redis.tar.gz"
compose "$proj" up -d --wait --pull never postgres redis >>"$LOG" 2>&1 || fail "subir postgres/redis"
sql() { compose "$proj" exec -T postgres sh -c 'exec psql -q -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -v ON_ERROR_STOP=1 '"${1:-}"; }
gzip -dc "$pacote/banco.sql.gz" | sql --single-transaction >>"$LOG" || fail "restaurar banco"
if [ "$modo" = --ensaio ]; then
  # Copia sem credenciais: o ensaio nunca pode assumir a sessao de WhatsApp da origem.
  echo 'update "Whatsapps" set session='"''"', qrcode='"''"', status='"'DISCONNECTED'"'; delete from "BaileysKeys";' | sql >>"$LOG" || fail "retirar sessoes de WhatsApp"
fi
compose "$proj" create --pull never backend >>"$LOG" 2>&1 || fail "criar backend"
restaurar -v "${proj}_backend_public:/d/public" -v "${proj}_backend_private:/d/private" < "$pacote/arquivos.tar.gz"

erros=0
conferir() { # nome esperado obtido
  if [ "$2" = "$3" ]; then log "  $1: $3 ok"; else log "  $1: esperado $2, veio $3"; erros=$((erros + 1)); fi
}
for t in Companies Users Contacts Tickets Messages Whatsapps SequelizeMeta; do
  conferir "$t" "$(m "linhas_$t")" "$(echo "select count(*) from \"$t\";" | sql)"
done
[ "$modo" = --ensaio ] || conferir BaileysKeys "$(m linhas_BaileysKeys)" "$(echo 'select count(*) from "BaileysKeys";' | sql)"
conferir arquivos "$(m arquivos)" "$(docker run --rm --network none --user 0:0 -v "${proj}_backend_public:/d/public:ro" -v "${proj}_backend_private:/d/private:ro" --entrypoint sh "$imagem" -c 'find /d ! -type d | wc -l' | tr -d ' ')"
if [ "$erros" != 0 ]; then
  # Copia feita com o sistema no ar pode divergir por mensagens que chegaram no meio.
  [ "$(m final)" = sim ] && fail "$erros conferencia(s) divergem; backend NAO iniciado"
  log "$erros divergencia(s), esperadas numa copia que nao e final"
fi

log "migracoes"
compose "$proj" --profile ops run --rm --no-deps migrate >>"$LOG" 2>&1 || fail "migracoes"
compose "$proj" up -d --wait --pull never backend frontend >>"$LOG" 2>&1 || fail "subir backend/frontend"
porta=$(valor "$dir/.env" ZK_HTTP_PORT)
got=$(curl -fsS --max-time 10 -H "Host: $host" "http://127.0.0.1:$porta/deployment.json" | python3 -c 'import json,sys;print(json.load(sys.stdin)["revision"])') || fail "frontend nao respondeu"
[ "$got" = "$rev" ] || fail "frontend serve $got"
curl -fsS --max-time 10 -o /dev/null -H "Host: $host" -H 'X-Forwarded-Proto: https' "http://127.0.0.1:$porta/backend/" || fail "backend nao respondeu"
if [ "$modo" = --definitivo ]; then
  mkdir -p "$STATE"
  if [ "$ambiente" = production ]; then echo "$rev" > "$STATE/prod.rev"; else echo "$rev" > "$STATE/dev.rev"; fi
fi
log "OK - $proj em ${rev:0:8}, respondendo em 127.0.0.1:$porta"
