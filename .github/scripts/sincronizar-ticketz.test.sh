#!/usr/bin/env bash
# Zap Komunick: tests for sincronizar-ticketz.sh with throwaway repositories and a fake gh.
#   bash .github/scripts/sincronizar-ticketz.test.sh
set -euo pipefail

script="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/sincronizar-ticketz.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
failures=0

pass() { echo "PASS $1"; }
fail() {
  echo "FAIL $1"
  failures=$((failures + 1))
}
check() { if eval "$2"; then pass "$1"; else fail "$1"; fi; }

export GIT_AUTHOR_NAME=teste GIT_AUTHOR_EMAIL=teste@example.com
export GIT_COMMITTER_NAME=teste GIT_COMMITTER_EMAIL=teste@example.com
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1

# fake gh: logs the calls; FAKE_PR is the number of the open pull request (empty = none)
mkdir -p "$tmp/bin"
cat >"$tmp/bin/gh" <<'EOF'
#!/usr/bin/env bash
echo "$*" >>"$GH_LOG"
case "$1 $2" in
  "pr list") echo "${FAKE_PR:-}" ;;
  "pr create") echo "https://github.com/exemplo/fork/pull/9" ;;
esac
EOF
chmod +x "$tmp/bin/gh"
export PATH="$tmp/bin:$PATH" GH_LOG="$tmp/gh.log" REPO=exemplo/fork

commit() { # dir file content message
  printf '%s\n' "$3" >"$1/$2"
  git -C "$1" add "$2"
  git -C "$1" commit --quiet -m "$4"
}

# upstream with main, fork with dev and main at the same commit
git init --quiet -b main "$tmp/up-work"
commit "$tmp/up-work" app.txt "linha 1" "inicial"
git clone --quiet --bare "$tmp/up-work" "$tmp/up.git"
git -C "$tmp/up-work" remote add origin "$tmp/up.git"
git clone --quiet --bare "$tmp/up.git" "$tmp/origin.git"
git -C "$tmp/origin.git" branch dev main
git clone --quiet "$tmp/origin.git" "$tmp/fork"
git -C "$tmp/fork" switch --quiet dev
export UPSTREAM_URL="$tmp/up.git"

run() { (cd "$tmp/fork" && bash "$script") >"$tmp/out.txt" 2>&1; }
sync_sha() { git -C "$tmp/origin.git" rev-parse --verify --quiet refs/heads/ticketz-upstream || true; }
up_sha() { git -C "$tmp/up.git" rev-parse main; }

# 1. nothing new
: >"$GH_LOG"
run
check "nothing new stops early" 'grep -q "Nada novo" "$tmp/out.txt" && [ -z "$(sync_sha)" ] && [ ! -s "$GH_LOG" ]'

# 2. new commits, no conflict: branch created and pull request opened
mkdir -p "$tmp/up-work/backend/src/database/migrations"
commit "$tmp/up-work" backend/src/database/migrations/20990101-nova.ts "migração" "feat: nova migração"
commit "$tmp/up-work" outro.txt "outro" "fix: outro arquivo"
git -C "$tmp/up-work" tag v9.9.9
git -C "$tmp/up-work" push --quiet --tags origin main
: >"$GH_LOG"
run || true
check "creates the sync branch at the Ticketz commit" '[ "$(sync_sha)" = "$(up_sha)" ]'
check "opens the pull request to dev" 'grep -q "^pr create --repo exemplo/fork --head ticketz-upstream --base dev" "$GH_LOG"'
check "titles the pull request with the version" 'grep -q "Atualizações do Ticketz até v9.9.9" "$GH_LOG"'

# body checks with a dry run
(cd "$tmp/fork" && DRY_RUN=1 bash "$script") >"$tmp/dry.txt" 2>&1
check "dry run lists the new migration" 'grep -q "20990101-nova.ts" "$tmp/dry.txt"'
check "dry run says there is no conflict" 'grep -q "Conflitos com \`dev\`:\*\* nenhum" "$tmp/dry.txt"'
check "dry run counts 2 commits" 'grep -q "Commits novos:\*\* 2" "$tmp/dry.txt"'

# 3. pull request already open: it is updated
: >"$GH_LOG"
FAKE_PR=7 run || true
check "updates the open pull request" 'grep -q "^pr edit 7" "$GH_LOG" && ! grep -q "^pr create" "$GH_LOG"'

# 4. conflict: dev and Ticketz change the same line
commit "$tmp/fork" app.txt "linha do fork" "fork muda app"
git -C "$tmp/fork" push --quiet origin dev
commit "$tmp/up-work" app.txt "linha do ticketz" "ticketz muda app"
git -C "$tmp/up-work" push --quiet origin main
(cd "$tmp/fork" && DRY_RUN=1 bash "$script") >"$tmp/dry.txt" 2>&1
check "conflict lists the file" 'grep -q "Conflitos com \`dev\`:\*\* sim" "$tmp/dry.txt" && grep -q "\`app.txt\`" "$tmp/dry.txt"'
: >"$GH_LOG"
run || true
check "fast-forwards the sync branch" '[ "$(sync_sha)" = "$(up_sha)" ]'

# 5. someone resolves the conflict on the sync branch; Ticketz moves on: the resolution is kept
git clone --quiet "$tmp/origin.git" "$tmp/resolver"
git -C "$tmp/resolver" switch --quiet ticketz-upstream
git -C "$tmp/resolver" merge --quiet origin/dev >/dev/null 2>&1 || true
printf '%s\n' "linha resolvida" >"$tmp/resolver/app.txt"
git -C "$tmp/resolver" add app.txt
git -C "$tmp/resolver" commit --quiet --no-edit
git -C "$tmp/resolver" push --quiet origin ticketz-upstream
resolution="$(sync_sha)"
commit "$tmp/up-work" terceiro.txt "terceiro" "feat: terceiro"
git -C "$tmp/up-work" push --quiet origin main
fork_head_before="$(git -C "$tmp/fork" rev-parse HEAD)"
run || true
new_sync="$(sync_sha)"
check "keeps the resolution and adds the new Ticketz commit" \
  'git -C "$tmp/origin.git" merge-base --is-ancestor "$resolution" "$new_sync" && git -C "$tmp/origin.git" merge-base --is-ancestor "$(up_sha)" "$new_sync"'
(cd "$tmp/fork" && DRY_RUN=1 bash "$script") >"$tmp/dry.txt" 2>&1
check "after the resolution there is no conflict" 'grep -q "Conflitos com \`dev\`:\*\* nenhum" "$tmp/dry.txt"'
check "does not touch the local checkout" \
  '[ "$(git -C "$tmp/fork" rev-parse HEAD)" = "$fork_head_before" ] && [ -z "$(git -C "$tmp/fork" status --porcelain)" ] && [ "$(git -C "$tmp/fork" branch --show-current)" = dev ]'

# 6. the pull request is merged into dev (merge commit); Ticketz moves on: the branch starts over
git -C "$tmp/fork" fetch --quiet origin
git -C "$tmp/fork" merge --quiet --no-ff --no-edit origin/ticketz-upstream
git -C "$tmp/fork" push --quiet origin dev
commit "$tmp/up-work" quarto.txt "quarto" "feat: quarto"
git -C "$tmp/up-work" push --quiet origin main
: >"$GH_LOG"
run || true
check "starts over from the Ticketz branch after the merge" '[ "$(sync_sha)" = "$(up_sha)" ]'
(cd "$tmp/fork" && DRY_RUN=1 bash "$script") >"$tmp/dry.txt" 2>&1
check "only the new commit is listed after the merge" 'grep -q "Commits novos:\*\* 1" "$tmp/dry.txt" && grep -q "feat: quarto" "$tmp/dry.txt"'

# 7. pull request cannot be created (Actions not allowed): fails and leaves the compare link
cat >"$tmp/bin/gh" <<'EOF'
#!/usr/bin/env bash
echo "$*" >>"$GH_LOG"
case "$1 $2" in
  "pr list") echo "" ;;
  "pr create") echo "GitHub Actions is not permitted to create or approve pull requests" >&2; exit 1 ;;
esac
EOF
commit "$tmp/up-work" quinto.txt "quinto" "feat: quinto"
git -C "$tmp/up-work" push --quiet origin main
if run; then status=0; else status=$?; fi
check "fails with the compare link when the pull request is refused" \
  '[ "$status" != 0 ] && grep -q "compare/dev...ticketz-upstream" "$tmp/out.txt"'

echo
if [ "$failures" = 0 ]; then
  echo "todos os testes passaram"
else
  echo "$failures teste(s) falharam"
  exit 1
fi
