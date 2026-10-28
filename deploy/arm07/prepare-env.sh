#!/usr/bin/env bash
# Gera arquivos novos, privados, sem emitir seus valores. Nunca recria uma master.
set -euo pipefail
umask 077

if [[ $# -lt 4 || $# -gt 5 ]]; then
    printf 'Uso: %s DIRETORIO REVISAO BACKEND_IMAGE FRONTEND_IMAGE [EMAIL_ADMIN]\n' "$0" >&2
    exit 2
fi

destination=$1
revision=$2
backend_image=$3
frontend_image=$4
admin_email=${5:-contato@komunick.com}

[[ "$destination" = /* ]] || { printf 'Use um diretorio absoluto fora do checkout.\n' >&2; exit 2; }
[[ "$revision" =~ ^[0-9a-f]{40}$ ]] || { printf 'Revisao Git completa obrigatoria.\n' >&2; exit 2; }
immutable_image='^(sha256:[0-9a-f]{64}|[a-zA-Z0-9._:/-]+@sha256:[0-9a-f]{64})$'
[[ "$backend_image" =~ $immutable_image && "$frontend_image" =~ $immutable_image ]] || {
    printf 'As duas imagens devem usar IDs ou digests sha256 imutaveis.\n' >&2; exit 2;
}
[[ "$admin_email" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || {
    printf 'Email administrativo invalido.\n' >&2; exit 2;
}
command -v openssl >/dev/null || { printf 'openssl necessario.\n' >&2; exit 2; }

mkdir -p -- "$destination"
destination=$(cd -- "$destination" && pwd -P)
if git -C "$destination" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    printf 'Escolha um diretorio fora de um checkout Git.\n' >&2
    exit 2
fi
for name in .env .env-backend .env-bootstrap; do
    [[ ! -e "$destination/$name" && ! -L "$destination/$name" ]] || {
        printf 'Configuracao ja existe; nao sobrescrever nem regenerar segredos.\n' >&2; exit 2;
    }
done
chmod 700 -- "$destination"

# noclobber impede que uma execucao concorrente substitua um arquivo existente.
set -o noclobber
database_password=$(openssl rand -hex 32)
master_key=$(openssl rand -base64 32)
admin_password="Aa1!$(openssl rand -hex 24)"

cat > "$destination/.env" <<EOF
ZK_REVISION=$revision
ZK_BACKEND_IMAGE=$backend_image
ZK_FRONTEND_IMAGE=$frontend_image
ZK_HTTP_PORT=5480
ZK_PUBLIC_ORIGIN=https://superchat.komunick.com
POSTGRES_USER=ticketz
POSTGRES_DB=ticketz
POSTGRES_PASSWORD=$database_password
TZ=America/Sao_Paulo
ZK_EDGE_SUBNET=172.29.251.0/28
ZK_EDGE_GATEWAY=172.29.251.1
ZK_FRONTEND_EDGE_IP=172.29.251.10
ZK_INTERNAL_SUBNET=172.29.252.0/28
ZK_FRONTEND_INTERNAL_IP=172.29.252.10
ZK_BACKEND_INTERNAL_IP=172.29.252.11
ZK_POSTGRES_INTERNAL_IP=172.29.252.12
ZK_REDIS_INTERNAL_IP=172.29.252.13
EOF
cat > "$destination/.env-backend" <<EOF
CREDENTIALS_MASTER_KEY=$master_key
CREDENTIALS_PREVIOUS_MASTER_KEY=
EOF
cat > "$destination/.env-bootstrap" <<EOF
EMAIL_ADDRESS=$admin_email
ADMIN_PASSWORD=$admin_password
EOF
unset database_password master_key admin_password
chmod 600 -- "$destination/.env" "$destination/.env-backend" "$destination/.env-bootstrap"
printf 'Tres arquivos privados criados. Guarde a master em cofre separado do backup do banco.\n'
printf 'A senha administrativa fica somente em .env-bootstrap; nao foi impressa.\n'
