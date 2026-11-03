#!/usr/bin/env bash
# Zap Komunick: brings the Ticketz updates (ticketz-oss/ticketz) into a pull request to dev.
#
# Keeps SYNC_BRANCH equal to the Ticketz branch (plus any conflict resolution someone commits on it) and opens or
# updates the pull request SYNC_BRANCH -> BASE_BRANCH. It never touches dev or main: merging is up to whoever reviews
# the pull request, always with "Create a merge commit" (see docs/ATUALIZACOES-DO-TICKETZ.md).
#
# Environment: REPO (owner/name, needed for the pull request), GH_TOKEN, UPSTREAM_URL, UPSTREAM_BRANCH, BASE_BRANCH,
# SYNC_BRANCH and DRY_RUN=1 (sends nothing, only prints what it would do).
set -euo pipefail

UPSTREAM_URL="${UPSTREAM_URL:-https://github.com/ticketz-oss/ticketz.git}"
UPSTREAM_BRANCH="${UPSTREAM_BRANCH:-main}"
BASE_BRANCH="${BASE_BRANCH:-dev}"
SYNC_BRANCH="${SYNC_BRANCH:-ticketz-upstream}"
DRY_RUN="${DRY_RUN:-0}"
SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"

log() {
  echo "$*"
  echo "$*" >>"$SUMMARY"
}

workdir="$(mktemp -d)"
cleanup() {
  git worktree remove --force "$workdir/merge" >/dev/null 2>&1 || true
  rm -rf "$workdir"
}
trap cleanup EXIT

if git remote get-url upstream >/dev/null 2>&1; then
  git remote set-url upstream "$UPSTREAM_URL"
else
  git remote add upstream "$UPSTREAM_URL"
fi

git fetch --quiet --no-tags origin "+refs/heads/$BASE_BRANCH:refs/remotes/origin/$BASE_BRANCH"
sync_exists=0
if git ls-remote --exit-code --heads origin "$SYNC_BRANCH" >/dev/null 2>&1; then
  git fetch --quiet --no-tags origin "+refs/heads/$SYNC_BRANCH:refs/remotes/origin/$SYNC_BRANCH"
  sync_exists=1
fi
git fetch --quiet --tags upstream "+refs/heads/$UPSTREAM_BRANCH:refs/remotes/upstream/$UPSTREAM_BRANCH"

base="refs/remotes/origin/$BASE_BRANCH"
upstream_sha="$(git rev-parse "refs/remotes/upstream/$UPSTREAM_BRANCH")"
short="${upstream_sha:0:7}"

if git merge-base --is-ancestor "$upstream_sha" "$base"; then
  log "Nada novo: $BASE_BRANCH já tem o $UPSTREAM_BRANCH do Ticketz ($short)."
  exit 0
fi

# Next state of the sync branch.
target="$upstream_sha"
force=0
if [ "$sync_exists" = 1 ]; then
  sync_sha="$(git rev-parse "refs/remotes/origin/$SYNC_BRANCH")"
  if git merge-base --is-ancestor "$upstream_sha" "$sync_sha"; then
    # already has this Ticketz version (maybe with a conflict resolution on top)
    target="$sync_sha"
  elif git merge-base --is-ancestor "$sync_sha" "$upstream_sha"; then
    : # plain fast-forward to the Ticketz branch
  elif git merge-base --is-ancestor "$sync_sha" "$base"; then
    # its commits are already in dev: start over from the Ticketz branch
    force=1
  else
    # someone committed on the branch (conflict resolution): keep it and bring the new Ticketz commits
    git worktree add --quiet --detach "$workdir/merge" "$sync_sha"
    if git -C "$workdir/merge" merge --quiet --no-edit \
      -m "Merge Ticketz $UPSTREAM_BRANCH ($short) into $SYNC_BRANCH" "$upstream_sha"; then
      target="$(git -C "$workdir/merge" rev-parse HEAD)"
    else
      git -C "$workdir/merge" merge --abort || true
      log "A branch $SYNC_BRANCH tem commits próprios que conflitam com o Ticketz novo ($short)."
      log "Resolva à mão: veja docs/ATUALIZACOES-DO-TICKETZ.md, seção \"Quando há conflito\"."
      exit 1
    fi
  fi
fi

# What the pull request will bring.
new_commits="$(git rev-list --count --no-merges "$base..$upstream_sha")"
version="$(git describe --tags "$upstream_sha" 2>/dev/null || echo "$short")"
merge_status=0
merge_output="$(git merge-tree --write-tree --name-only --no-messages "$base" "$target" 2>/dev/null)" ||
  merge_status=$?
conflicts=""
if [ "$merge_status" = 1 ]; then
  conflicts="$(printf '%s\n' "$merge_output" | sed -n '2,$p' | sed '/^$/d')"
elif [ "$merge_status" != 0 ]; then
  conflicts="(não deu para verificar; confira no PR)"
fi
migrations="$(git diff --name-only --diff-filter=A "$base...$upstream_sha" -- backend/src/database/migrations)"
dependencies="$(git diff --name-only "$base...$upstream_sha" -- '*package.json' '*package-lock.json')"
commit_list="$(git log --no-merges -n 60 --date=short --format='- `%h` %s (%an, %ad)' "$base..$upstream_sha")"

as_list() {
  if [ -n "$1" ]; then
    printf '%s\n' "$1" | sed 's/^/  - `/; s/$/`/'
  fi
}

body="$workdir/body.md"
{
  echo "Atualizações do [Ticketz](https://github.com/ticketz-oss/ticketz) (\`$UPSTREAM_BRANCH\`) que ainda não estão em \`$BASE_BRANCH\`."
  echo
  echo "- **Commits novos:** $new_commits, até \`$short\` (\`$version\`)"
  if [ -n "$conflicts" ]; then
    echo "- **Conflitos com \`$BASE_BRANCH\`:** sim, nestes arquivos:"
    as_list "$conflicts"
  else
    echo "- **Conflitos com \`$BASE_BRANCH\`:** nenhum"
  fi
  if [ -n "$migrations" ]; then
    echo "- **Migrações novas** (rodam na subida do backend):"
    as_list "$migrations"
  else
    echo "- **Migrações novas:** nenhuma"
  fi
  if [ -n "$dependencies" ]; then
    echo "- **Dependências alteradas:**"
    as_list "$dependencies"
  fi
  echo
  echo "### Como integrar"
  echo
  echo "1. Use **Create a merge commit**, nunca squash nem rebase. O merge guarda a ligação com o histórico do Ticketz,"
  echo "   e a próxima sincronização traz só o que for novo."
  echo "2. Com conflito, resolva nesta branch (\`$SYNC_BRANCH\`) mantendo as mudanças do Zap Komunick. O workflow não"
  echo "   apaga o que for commitado aqui."
  echo "3. Antes de integrar, rode os testes do backend e suba o ambiente de desenvolvimento para as migrações novas."
  echo
  echo "Detalhes em \`docs/ATUALIZACOES-DO-TICKETZ.md\`."
  echo
  echo "### Commits"
  echo
  echo "$commit_list"
  if [ "$new_commits" -gt 60 ]; then
    echo "- … e mais $((new_commits - 60))"
  fi
  echo
  echo "_Aberto pelo workflow \"Sincronizar com o Ticketz\"; ele atualiza este PR enquanto estiver aberto._"
} >"$body"

title="Atualizações do Ticketz até $version"

if [ "$DRY_RUN" = 1 ]; then
  log "DRY_RUN: $SYNC_BRANCH iria para ${target:0:7} (force=$force); PR \"$title\" para $BASE_BRANCH."
  cat "$body"
  exit 0
fi

if [ "$force" = 1 ]; then
  push_args=(--force-with-lease="refs/heads/$SYNC_BRANCH:$sync_sha")
else
  push_args=()
fi
if ! git push --quiet "${push_args[@]}" origin "$target:refs/heads/$SYNC_BRANCH"; then
  log "Não consegui enviar a branch $SYNC_BRANCH."
  log "Se o Ticketz mudou arquivos em .github/workflows, o token padrão do Actions não pode enviá-los: configure o"
  log "segredo SINCRONIZAR_TICKETZ_TOKEN (docs/ATUALIZACOES-DO-TICKETZ.md)."
  exit 1
fi

pr="$(gh pr list --repo "$REPO" --head "$SYNC_BRANCH" --base "$BASE_BRANCH" --state open \
  --json number --jq '.[0].number // empty')"
if [ -n "$pr" ]; then
  gh pr edit "$pr" --repo "$REPO" --title "$title" --body-file "$body" >/dev/null
  log "PR #$pr atualizado: $title."
elif url="$(gh pr create --repo "$REPO" --head "$SYNC_BRANCH" --base "$BASE_BRANCH" \
  --title "$title" --body-file "$body" 2>&1)"; then
  log "PR aberto: $url"
else
  log "A branch $SYNC_BRANCH foi atualizada, mas não consegui abrir o PR: $url"
  log "Abra pela comparação: https://github.com/$REPO/compare/$BASE_BRANCH...$SYNC_BRANCH?expand=1"
  log "Para o workflow abrir sozinho, veja \"Configuração única\" em docs/ATUALIZACOES-DO-TICKETZ.md."
  exit 1
fi
