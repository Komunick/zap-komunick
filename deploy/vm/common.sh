#!/usr/bin/env bash
# Funcoes comuns do pacote de VM. Carregado por zapk.sh, importar.sh e instalar.sh.
# Nada aqui depende de uma VM especifica: o que muda fica em $ROOT/host.env.

ROOT=${ZAPK_ROOT:-/opt/zap-komunick}
BIN=$ROOT/bin
CHECKOUT=$ROOT/checkout
STATE=$ROOT/state
LOG=${ZAPK_LOG:-/var/log/zapk-deploy.log}
ACTION=${ACTION:-vm}

log()  { echo "$(date -Is) [$ACTION] $*" | tee -a "$LOG" >&2; }
fail() { log "FALHOU: $*"; exit 1; }

# Le somente as chaves conhecidas, sem executar o arquivo.
carregar_host() {
  local chave valor
  [ -f "$ROOT/host.env" ] || { echo "falta $ROOT/host.env (veja host.env.example)" >&2; exit 1; }
  ZAPK_HOST='' ZAPK_INGRESS='' ZAPK_INGRESS_NETWORK='' ZAPK_TRUSTED_CIDR=''
  ZAPK_REPO='https://github.com/Komunick/zap-komunick.git'
  while IFS='=' read -r chave valor || [ -n "$chave" ]; do
    valor=${valor%$'\r'}
    case "$chave" in
      ZAPK_HOST|ZAPK_INGRESS|ZAPK_INGRESS_NETWORK|ZAPK_TRUSTED_CIDR|ZAPK_REPO)
        printf -v "$chave" '%s' "$valor" ;;
      ''|\#*) ;;
      *) echo "chave desconhecida em host.env: $chave" >&2; exit 1 ;;
    esac
  done < "$ROOT/host.env"
  [ "$(hostname -s)" = "$ZAPK_HOST" ] || { echo "esta VM e $(hostname -s); host.env espera '$ZAPK_HOST'" >&2; exit 1; }
  case "$ZAPK_INGRESS" in
    traefik)
      [[ "$ZAPK_INGRESS_NETWORK" =~ ^[a-zA-Z0-9_.-]+$ ]] || { echo "ZAPK_INGRESS_NETWORK invalida" >&2; exit 1; }
      [[ "$ZAPK_TRUSTED_CIDR" =~ ^[0-9]+(\.[0-9]+){3}/[0-9]+$ ]] || { echo "ZAPK_TRUSTED_CIDR invalido" >&2; exit 1; } ;;
    caddy) ;;
    *) echo "ZAPK_INGRESS precisa ser traefik ou caddy" >&2; exit 1 ;;
  esac
}

travar() {
  [ -n "${ZAPK_LOCKED:-}" ] && return 0
  exec 9>"${ZAPK_LOCK:-/var/lock/zapk-deploy.lock}"
  flock -n 9 || return 1
  export ZAPK_LOCKED=1
}

GIT() { git -c "safe.directory=$CHECKOUT" -C "$CHECKOUT" "$@"; }

# projeto e dominio de cada ambiente; o dominio esta gravado na imagem do frontend
perfil() { # production|development
  case "$1" in
    production)  proj=superchat;    tag=prod; host=superchat.komunick.com ;;
    development) proj=superchatdev; tag=dev;  host=superchatdev.komunick.com ;;
    *) fail "ambiente invalido: $1" ;;
  esac
}

# Exporta a revisao (sem .git), ajusta a confianca do nginx no Traefik e constroi o backend.
prepare_export() {
  local rev=$1 exp=$ROOT/exports/$1 mascara
  # o contexto do build precisa ser legivel pelos usuarios sem root das imagens
  mascara=$(umask); umask 022
  if [ ! -d "$exp" ]; then
    GIT cat-file -e "$rev^{commit}" 2>/dev/null || GIT fetch -q origin "$rev" || fail "git fetch $rev"
    rm -rf "$exp.tmp"; mkdir -p "$exp.tmp"
    GIT archive "$rev" | tar -x -C "$exp.tmp" || fail "git archive"
    if [ "$ZAPK_INGRESS" = traefik ]; then
      python3 - "$exp.tmp/deploy/arm07/nginx.conf" "$ZAPK_TRUSTED_CIDR" <<'PY' || fail "ajuste do nginx nao aplicou (o nginx.conf mudou?)"
import sys
p, cidr = sys.argv[1:]
s = open(p).read()
old = "        set_real_ip_from 127.0.0.1;\n"
assert s.count(old) == 1
open(p, "w").write(s.replace(old, old + "        set_real_ip_from %s;\n" % cidr))
PY
    fi
    mv "$exp.tmp" "$exp"
  fi
  if ! docker image inspect "zapk-backend:$rev" >/dev/null 2>&1; then
    log "build backend $rev"
    ( cd "$exp" && docker build -q --platform linux/arm64 -f deploy/arm07/Dockerfile.backend \
        --build-arg SOURCE_REVISION="$rev" -t "zapk-backend:$rev" . ) >>"$LOG" 2>&1 || fail "build backend"
  fi
  umask "$mascara"
}

build_frontend() { # REV production|development
  local rev=$1 proj tag host
  perfil "$2"
  docker image inspect "zapk-frontend-$tag:$rev" >/dev/null 2>&1 && return 0
  log "build frontend-$tag $rev"
  ( cd "$ROOT/exports/$rev" && docker build -q --platform linux/arm64 -f deploy/arm07/Dockerfile.frontend \
      --build-arg SOURCE_REVISION="$rev" --build-arg ZK_ENVIRONMENT="$2" --build-arg ZK_PUBLIC_HOST="$host" \
      -t "zapk-frontend-$tag:$rev" . ) >>"$LOG" 2>&1 || fail "build frontend-$tag"
}

definir() { # ARQUIVO CHAVE VALOR: troca ou acrescenta uma linha do .env
  if grep -q "^$2=" "$1"; then sed -i "s|^$2=.*|$2=$3|" "$1"; else printf '%s=%s\n' "$2" "$3" >> "$1"; fi
}

valor() { # ARQUIVO CHAVE
  sed -n "s/^$2=//p" "$1" | head -1
}

# Copia o pacote operacional e fixa imagens e rede de entrada na release.
preparar_release() { # DIR REV AMBIENTE
  local dir=$1 rev=$2 proj tag host prefixo
  perfil "$3"
  cp "$ROOT/exports/$rev/deploy/arm07/"{compose.yaml,backup.sh,environment.sh,environment.cjs} "$dir/" || fail "copiar pacote"
  cp "$BIN/"override.*.yaml "$dir/" || fail "copiar overrides"
  install -m 0444 "$BIN/whatsapp-connect-proxy.cjs" "$dir/whatsapp-connect-proxy.cjs" || fail "copiar proxy"
  prefixo=$(valor "$dir/.env" ZK_BACKEND_INTERNAL_IP); prefixo=${prefixo%.*}
  definir "$dir/.env" ZK_REVISION "$rev"
  definir "$dir/.env" ZK_BACKEND_IMAGE "$(docker image inspect "zapk-backend:$rev" --format '{{.Id}}')"
  definir "$dir/.env" ZK_FRONTEND_IMAGE "$(docker image inspect "zapk-frontend-$tag:$rev" --format '{{.Id}}')"
  definir "$dir/.env" ZK_PUBLIC_HOST "$host"
  definir "$dir/.env" ZK_INGRESS_NETWORK "${ZAPK_INGRESS_NETWORK:-sem-rede}"
  definir "$dir/.env" ZK_PROXY_INTERNAL_IP "$prefixo.14"
}

compose() { # PROJETO ...  (usa current)
  local d=$ROOT/$1/current arquivos; shift
  arquivos=(-f "$d/compose.yaml")
  if [ -f "$d/ENSAIO" ]; then
    arquivos+=(-f "$d/override.ensaio.yaml")
  else
    [ "$ZAPK_INGRESS" = traefik ] && arquivos+=(-f "$d/override.traefik.yaml")
    arquivos+=(-f "$d/override.egress.yaml")
  fi
  docker compose --project-directory "$d" --env-file "$d/.env" "${arquivos[@]}" "$@"
}
