#!/usr/bin/env bash
# Deploy do SuperChat em qualquer VM ARM64 preparada por instalar.sh.
#   zapk.sh poll             -> se a branch monitorada tem commit novo, faz deploy-dev
#   zapk.sh deploy-dev [REV] -> constroi e sobe a homologacao
#   zapk.sh promote [REV]    -> APROVACAO: sobe a producao com a revisao da homologacao
# A producao nunca e atualizada pelo poller: so por "promote", rodado por uma pessoa.
set -uo pipefail
ACTION="${1:-}"; ARG_REV="${2:-}"
# shellcheck source=common.sh
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)/common.sh"
carregar_host
mkdir -p "$STATE"
# O poll chama deploy-dev como filho: o filho herda o fd 9 ja travado.
travar || { [ "$ACTION" = poll ] && exit 0; fail "ja existe um deploy em andamento"; }
[ -f "$LOG" ] && [ "$(stat -c%s "$LOG")" -gt 2097152 ] && tail -c 524288 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
BRANCH=$(cat "$ROOT/branch" 2>/dev/null || echo dev)

make_release() { # AMBIENTE REV: segredos copiados de current, nunca regenerados
  local proj tag host dir base
  perfil "$1"; base=$ROOT/$proj; dir=$base/releases/$2
  [ -e "$base/current/.env" ] || fail "$proj nao tem release corrente"
  [ -f "$base/current/ENSAIO" ] && fail "$proj e um ensaio"
  mkdir -p "$dir"; chmod 700 "$dir"
  if [ ! -f "$dir/.env" ]; then
    ( umask 077; cp "$base/current/.env" "$base/current/.env-backend" "$dir/" ) || fail "copiar segredos"
  fi
  preparar_release "$dir" "$2" "$1"
  ln -sfn "$dir" "$base/current.new" && mv -T "$base/current.new" "$base/current"
}

# Migra, sobe e confere pelo dominio publico que a revisao nova esta servindo.
roll_out() { # AMBIENTE REV
  local proj tag host rev=$2 got="" _
  perfil "$1"
  compose "$proj" up -d --wait --pull never postgres redis >>"$LOG" 2>&1 || fail "postgres/redis"
  log "migracoes"
  compose "$proj" --profile ops run --rm --no-deps migrate >>"$LOG" 2>&1 || fail "migracoes (banco preservado; versao anterior segue em execucao)"
  log "subindo backend + frontend"
  compose "$proj" up -d --wait --pull never backend frontend >>"$LOG" 2>&1 || fail "subir backend/frontend"
  for _ in 1 2 3 4 5 6; do
    got=$(curl -fsS --max-time 10 "https://$host/deployment.json" 2>/dev/null | python3 -c 'import json,sys;print(json.load(sys.stdin)["revision"])' 2>/dev/null)
    [ "$got" = "$rev" ] && return 0; sleep 5
  done
  fail "https://$host serve '${got:-nada}', esperado $rev"
}

prune_old() { # mantem as 3 revisoes mais recentes de cada imagem
  local repo
  for repo in zapk-backend zapk-frontend-dev zapk-frontend-prod; do
    docker images "$repo" --format '{{.CreatedAt}}\t{{.Repository}}:{{.Tag}}' | sort -r | awk -F'\t' 'NR>3{print $2}' | xargs -r docker rmi >/dev/null 2>&1 || true
  done
}

case "$ACTION" in
  poll)
    remote=$(timeout 60 git ls-remote "$ZAPK_REPO" "refs/heads/$BRANCH" 2>/dev/null | awk 'NR==1{print $1}')
    [ -n "$remote" ] || { log "nao consegui ler o SHA de $BRANCH"; exit 0; }
    last=$(cat "$STATE/dev.rev" 2>/dev/null || true)
    [ "$remote" = "$last" ] && exit 0
    if [ -n "$last" ]; then
      GIT merge-base --is-ancestor "$remote" "$last" 2>/dev/null && exit 0
      # Um merge pode dar outro SHA ao mesmo conteudo que ja esta no ar.
      deployed_tree=$(GIT rev-parse --verify "$last^{tree}") || fail "tree da revisao em execucao"
      GIT cat-file -e "$remote^{commit}" 2>/dev/null || GIT fetch -q --no-tags origin "$remote" || fail "git fetch $remote"
      remote_tree=$(GIT rev-parse --verify "$remote^{tree}") || fail "tree de $remote"
      [ "$remote_tree" = "$deployed_tree" ] && exit 0
    fi
    [ "$remote" = "$(cat "$STATE/poll.failed" 2>/dev/null)" ] && exit 0   # nao reconstroi em loop
    log "commit novo em $BRANCH: $remote (anterior ${last:-nenhum}) -> deploy no dev"
    if "$0" deploy-dev "$remote" >/dev/null 2>&1; then rm -f "$STATE/poll.failed"; else echo "$remote" > "$STATE/poll.failed"; fi
    ;;

  deploy-dev)
    GIT fetch --prune -q origin "$BRANCH" || fail "git fetch $BRANCH"
    REV=${ARG_REV:-$(GIT rev-parse "origin/$BRANCH")}
    GIT cat-file -e "$REV^{commit}" || fail "revisao $REV desconhecida"
    log "dev: $REV"
    prepare_export "$REV"; build_frontend "$REV" development
    make_release development "$REV"
    roll_out development "$REV"
    echo "$REV" > "$STATE/dev.rev"
    prune_old
    log "OK - dev em ${REV:0:8}. Para aprovar em producao: sudo $0 promote"
    ;;

  promote)
    REV=${ARG_REV:-$(cat "$STATE/dev.rev" 2>/dev/null)}
    [ -n "$REV" ] || fail "sem revisao no dev para promover"
    [ "$REV" = "$(cat "$STATE/dev.rev" 2>/dev/null)" ] || fail "$REV nao e a revisao atualmente no dev; homologue-a no dev antes"
    [ "$REV" = "$(cat "$STATE/prod.rev" 2>/dev/null)" ] && { log "producao ja esta em ${REV:0:8}"; exit 0; }
    log "PROMOVENDO ${REV:0:8} para producao (aprovado)"
    [ -d "$ROOT/exports/$REV" ] || fail "export de $REV ausente"
    mkdir -p "$ROOT/superchat/backups"
    BK=$ROOT/superchat/backups/$(date +%Y%m%d-%H%M%S)-pre-${REV:0:8}
    log "backup de producao em $BK"
    ( cd "$ROOT/superchat/current" && bash ./backup.sh "$BK" ) >>"$LOG" 2>&1 || fail "backup de producao (nada foi alterado)"
    prepare_export "$REV"; build_frontend "$REV" production
    make_release production "$REV"
    roll_out production "$REV"
    echo "$REV" > "$STATE/prod.rev"
    prune_old
    log "OK - producao em ${REV:0:8}"
    ;;

  *) echo "uso: $0 <poll|deploy-dev [REV]|promote [REV]>" >&2; exit 2 ;;
esac
