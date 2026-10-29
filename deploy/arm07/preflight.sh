#!/usr/bin/env bash
# Inspects host, files and immutable image metadata; never starts the application.
set -euo pipefail
mode=${1:-prepare}
case "$mode" in prepare|--host-only|--activation) ;; *) printf 'Uso: %s [--host-only AMBIENTE|--activation]\n' "$0" >&2; exit 2;; esac
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=environment.sh
source "$root/environment.sh"
get_value() {
    local key=$1
    awk -F= -v key="$key" '$1 == key {count++; value=substr($0, index($0,"=")+1)} END {if(count != 1) exit 1; print value}' "$root/.env"
}
if [[ "$mode" = --host-only ]]; then
    arm07_profile "${2:-}"
else
    [[ -f "$root/.env" && ! -L "$root/.env" ]] || { printf 'Arquivo privado .env necessario.\n' >&2; exit 1; }
    arm07_profile "$(get_value ZK_ENVIRONMENT)"
fi
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
printf 'Ambiente %s; DNS A de %s: %s; ARM07 esperada: %s\n' "$profile" "$domain" "${dns_addresses:-sem resposta}" "$expected_ip"
if [[ "$mode" = --host-only ]]; then
    ss -ltn | awk 'NR == 1 || $4 ~ /:(80|443|5480|5481)$/ {print}'
    printf 'Preflight do host concluido; nenhuma configuracao foi aplicada.\n'
    exit 0
fi
for file in compose.yaml .env .env-backend Caddyfile "Caddyfile.$profile"; do
    [[ -f "$root/$file" && ! -L "$root/$file" ]] || { printf 'Arquivo necessario ausente ou symlink: %s\n' "$file" >&2; exit 1; }
done
for file in .env .env-backend .env-bootstrap; do
    if [[ "$file" = .env-bootstrap && ! -e "$root/$file" ]]; then continue; fi
    [[ ! -L "$root/$file" ]] || { printf 'Ambiente privado nao pode ser symlink.\n' >&2; exit 1; }
    permissions=$(stat -c '%a' "$root/$file")
    [[ "$permissions" = 600 || "$permissions" = 400 ]] || { printf 'Arquivo privado exige permissao 600/400: %s\n' "$file" >&2; exit 1; }
done
# A mixed profile must fail before Compose or Caddy can operate on a different stack.
expect_value() {
    local key=$1 expected=$2 actual
    actual=$(get_value "$key")
    [[ "$actual" = "$expected" ]] || { printf 'Configuracao nao corresponde ao perfil: %s\n' "$key" >&2; exit 1; }
    if [[ -v "$key" && "${!key}" != "$actual" ]]; then
        printf 'Override externo diverge do perfil: %s\n' "$key" >&2; exit 1
    fi
}
expect_value ZK_ENVIRONMENT "$profile"
expect_value COMPOSE_PROJECT_NAME "$project"
expect_value ZK_HTTP_PORT "$http_port"
expect_value ZK_EDGE_SUBNET "$edge_prefix.0/28"
expect_value ZK_EDGE_GATEWAY "$edge_prefix.1"
expect_value ZK_FRONTEND_EDGE_IP "$edge_prefix.10"
expect_value ZK_INTERNAL_SUBNET "$internal_prefix.0/28"
expect_value ZK_FRONTEND_INTERNAL_IP "$internal_prefix.10"
expect_value ZK_BACKEND_INTERNAL_IP "$internal_prefix.11"
expect_value ZK_POSTGRES_INTERNAL_IP "$internal_prefix.12"
expect_value ZK_REDIS_INTERNAL_IP "$internal_prefix.13"
expect_value POSTGRES_USER ticketz
expect_value POSTGRES_DB ticketz
revision=$(get_value ZK_REVISION)
[[ "$revision" =~ ^[0-9a-f]{40}$ ]] || { printf 'Revisao invalida.\n' >&2; exit 1; }
expect_value ZK_REVISION "$revision"
# prepare permits an explicit isolated TLS QA port; public activation requires 443.
public_origin=$(get_value ZK_PUBLIC_ORIGIN)
if [[ "$public_origin" != "https://$domain" ]]; then
    qa_port=${public_origin#"https://$domain:"}
    [[ "$public_origin" = "https://$domain:$qa_port" && "$qa_port" =~ ^[1-9][0-9]{0,4}$ ]] && (( qa_port <= 65535 )) || {
        printf 'Origem nao corresponde ao perfil.\n' >&2; exit 1;
    }
fi
expect_value ZK_PUBLIC_ORIGIN "$public_origin"
cmp -s "$root/Caddyfile" "$root/Caddyfile.$profile" || { printf 'Fragmento Caddy nao corresponde ao perfil.\n' >&2; exit 1; }
for key in ZK_BACKEND_IMAGE ZK_FRONTEND_IMAGE; do
    image=$(get_value "$key")
    expect_value "$key" "$image"
    [[ "$image" =~ ^sha256:[0-9a-f]{64}$ || "$image" =~ @sha256:[0-9a-f]{64}$ ]] || { printf 'Imagem nao fixada por hash.\n' >&2; exit 1; }
    image_arch=$(docker image inspect --format '{{.Os}}/{{.Architecture}}' "$image")
    image_revision=$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image")
    [[ "$image_arch" = linux/arm64 && "$image_revision" = "$revision" ]] || { printf 'Arquitetura/revisao incorreta na imagem %s.\n' "$key" >&2; exit 1; }
    if [[ "$key" = ZK_FRONTEND_IMAGE ]]; then
        image_profile=$(docker image inspect --format '{{index .Config.Labels "com.komunick.environment"}}' "$image")
        image_host=$(docker image inspect --format '{{index .Config.Labels "com.komunick.public-host"}}' "$image")
        [[ "$image_profile" = "$profile" && "$image_host" = "$domain" ]] || { printf 'Frontend pertence a outro ambiente.\n' >&2; exit 1; }
        # No app or network: read only the five-field public config from the image.
        image_config=$(docker run --rm --network none --read-only --cap-drop ALL --security-opt no-new-privileges --entrypoint cat "$image" /var/www/public/config.json)
        expected_config='{"BACKEND_PROTOCOL":"https","BACKEND_HOST":"'"$domain"'","BACKEND_PORT":"443","BACKEND_PATH":"/backend","WAVOIP_ENABLED":false}'
        [[ "$image_config" = "$expected_config" ]] || { printf 'Config publico do frontend diverge do perfil.\n' >&2; exit 1; }
    fi
done
docker compose --project-directory "$root" --env-file "$root/.env" -f "$root/compose.yaml" config --quiet
caddy adapt --config "$root/Caddyfile" --adapter caddyfile >/dev/null
if [[ "$mode" = --activation ]]; then
    [[ "$public_origin" = "https://$domain" ]] || { printf 'Ativacao bloqueada: retirar porta de QA antes da publicacao.\n' >&2; exit 1; }
    [[ "$dns_ok" = true ]] || { printf 'Ativacao bloqueada: resolver a divergencia de DNS antes de habilitar HTTPS.\n' >&2; exit 1; }
    if ss -ltnH | awk -v port=":$http_port" '$4 ~ port"$" {found=1} END {exit !found}'; then
        printf 'Ativacao bloqueada: a porta local esta ocupada; identificar o dono antes de alterar.\n' >&2; exit 1
    fi
    printf 'Preflight de ativacao aprovado. Ele nao concede autorizacao nem publica o site.\n'
else
    printf 'Candidato %s conferido. DNS/AAAA continuam pendencias para ativacao.\n' "$profile"
fi
