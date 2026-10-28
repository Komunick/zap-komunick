#!/usr/bin/env bash
# Somente leitura: nao instala, sobe, altera DNS, migra ou recarrega servicos.
set -euo pipefail
mode=${1:-prepare}
case "$mode" in prepare|--host-only|--activation) ;; *) printf 'Uso: %s [--host-only|--activation]\n' "$0" >&2; exit 2;; esac
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
domain=superchat.komunick.com
expected_ip=170.9.14.1

[[ $(uname -m) = aarch64 || $(uname -m) = arm64 ]] || { printf 'Destino precisa ser ARM64.\n' >&2; exit 1; }
[[ $(hostname -s) = arm07 ]] || { printf 'Hostname de destino precisa ser arm07.\n' >&2; exit 1; }
for tool in docker caddy getent ss; do command -v "$tool" >/dev/null || { printf 'Ferramenta ausente: %s\n' "$tool" >&2; exit 1; }; done
docker compose version
docker info --format 'Docker: {{.ServerVersion}} / {{.Architecture}}'
caddy version
free -m | awk '/^Mem:/ {printf "Memoria disponivel: %s MiB\n", $7}'
df -Pm / | awk 'NR == 2 {printf "Disco disponivel: %s MiB\n", $4}'

dns_addresses=$(getent ahostsv4 "$domain" | awk '{print $1}' | sort -u || true)
dns_ok=false
if [[ "$dns_addresses" = "$expected_ip" ]]; then dns_ok=true; fi
printf 'DNS A observado: %s; ARM07 esperada: %s\n' "${dns_addresses:-sem resposta}" "$expected_ip"
if [[ "$mode" = --host-only ]]; then
    ss -ltn | awk 'NR == 1 || $4 ~ /:(80|443|5480)$/ {print}'
    printf 'Preflight do host concluido; nenhuma configuracao foi aplicada.\n'
    exit 0
fi

for file in compose.yaml .env .env-backend Caddyfile; do
    [[ -f "$root/$file" && ! -L "$root/$file" ]] || { printf 'Arquivo necessario ausente ou symlink: %s\n' "$file" >&2; exit 1; }
done
for file in .env .env-backend .env-bootstrap; do
    if [[ "$file" = .env-bootstrap && ! -e "$root/$file" ]]; then continue; fi
    [[ ! -L "$root/$file" ]] || { printf 'Ambiente privado nao pode ser symlink.\n' >&2; exit 1; }
    permissions=$(stat -c '%a' "$root/$file")
    [[ "$permissions" = 600 || "$permissions" = 400 ]] || { printf 'Arquivo privado exige permissao 600/400: %s\n' "$file" >&2; exit 1; }
done
get_value() {
    local key=$1
    awk -F= -v key="$key" '$1 == key {count++; value=substr($0, index($0,"=")+1)} END {if(count != 1) exit 1; print value}' "$root/.env"
}
revision=$(get_value ZK_REVISION)
port=$(get_value ZK_HTTP_PORT)
[[ "$revision" =~ ^[0-9a-f]{40}$ && "$port" =~ ^[0-9]+$ ]] || { printf 'Revisao/porta invalidas.\n' >&2; exit 1; }
edge_gateway=$(get_value ZK_EDGE_GATEWAY)
[[ "$edge_gateway" = 172.29.251.1 ]] || { printf 'Gateway diferente do proxy confiado na imagem nginx; revisar o candidato.\n' >&2; exit 1; }
for key in ZK_BACKEND_IMAGE ZK_FRONTEND_IMAGE; do
    image=$(get_value "$key")
    [[ "$image" =~ ^sha256:[0-9a-f]{64}$ || "$image" =~ @sha256:[0-9a-f]{64}$ ]] || { printf 'Imagem nao fixada por hash.\n' >&2; exit 1; }
    image_arch=$(docker image inspect --format '{{.Os}}/{{.Architecture}}' "$image")
    image_revision=$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image")
    [[ "$image_arch" = linux/arm64 && "$image_revision" = "$revision" ]] || { printf 'Arquitetura/revisao incorreta na imagem %s.\n' "$key" >&2; exit 1; }
done
docker compose --project-directory "$root" --env-file "$root/.env" -f "$root/compose.yaml" config --quiet
caddy adapt --config "$root/Caddyfile" --adapter caddyfile >/dev/null
if [[ "$mode" = --activation ]]; then
    public_origin=$(get_value ZK_PUBLIC_ORIGIN)
    [[ "$public_origin" = https://superchat.komunick.com ]] || { printf 'Ativacao bloqueada: retirar origem/porta de QA antes da publicacao.\n' >&2; exit 1; }
    [[ "$port" = 5480 ]] || { printf 'Ativacao bloqueada: a porta precisa corresponder ao fragmento Caddy (5480).\n' >&2; exit 1; }
    [[ "$dns_ok" = true ]] || { printf 'Ativacao bloqueada: resolver a divergencia de DNS antes de habilitar HTTPS.\n' >&2; exit 1; }
    if ss -ltnH | awk -v port=":$port" '$4 ~ port"$" {found=1} END {exit !found}'; then
        printf 'Ativacao bloqueada: a porta local esta ocupada; identificar o dono antes de alterar.\n' >&2
        exit 1
    fi
    printf 'Preflight de ativacao aprovado. Ele nao concede autorizacao nem publica o site.\n'
else
    printf 'Candidato conferido. DNS divergente continua sendo pendencia para ativacao.\n'
fi
