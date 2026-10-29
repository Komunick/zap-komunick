#!/usr/bin/env bash
# Gera arquivos novos, privados, sem emitir seus valores. Nunca recria uma master.
set -euo pipefail
umask 077

if [[ $# != 6 ]]; then
    printf 'Uso: %s DIRETORIO REVISAO BACKEND_IMAGE FRONTEND_IMAGE EMAIL_ADMIN AMBIENTE\n' "$0" >&2
    exit 2
fi

destination=$1
revision=$2
backend_image=$3
frontend_image=$4
admin_email=$5
script_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=environment.sh
source "$script_root/environment.sh"
arm07_profile "$6"
[[ -f "$script_root/Caddyfile.$profile" ]] || { printf 'Fragmento do perfil ausente.\n' >&2; exit 2; }

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
for name in .env .env-backend .env-bootstrap Caddyfile; do
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
ZK_ENVIRONMENT=$profile
COMPOSE_PROJECT_NAME=$project
ZK_REVISION=$revision
ZK_BACKEND_IMAGE=$backend_image
ZK_FRONTEND_IMAGE=$frontend_image
ZK_HTTP_PORT=$http_port
ZK_PUBLIC_ORIGIN=https://$domain
POSTGRES_USER=ticketz
POSTGRES_DB=ticketz
POSTGRES_PASSWORD=$database_password
TZ=America/Sao_Paulo
ZK_EDGE_SUBNET=$edge_prefix.0/28
ZK_EDGE_GATEWAY=$edge_prefix.1
ZK_FRONTEND_EDGE_IP=$edge_prefix.10
ZK_INTERNAL_SUBNET=$internal_prefix.0/28
ZK_FRONTEND_INTERNAL_IP=$internal_prefix.10
ZK_BACKEND_INTERNAL_IP=$internal_prefix.11
ZK_POSTGRES_INTERNAL_IP=$internal_prefix.12
ZK_REDIS_INTERNAL_IP=$internal_prefix.13
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
cat "$script_root/Caddyfile.$profile" > "$destination/Caddyfile"
chmod 600 -- "$destination/.env" "$destination/.env-backend" "$destination/.env-bootstrap"
chmod 600 -- "$destination/Caddyfile"
printf 'Ambiente %s: projeto %s, origem https://%s, loopback %s.\n' "$profile" "$project" "$domain" "$http_port"
printf 'Tres arquivos privados criados. Guarde a master em cofre separado do backup do banco.\n'
printf 'A senha administrativa fica somente em .env-bootstrap; nao foi impressa.\n'
