#!/usr/bin/env bash
# Confere se a VM de destino aceita o SuperChat. So le; nao instala nem altera nada.
set -uo pipefail
erros=0 avisos=0
ok()    { printf 'ok     %s\n' "$*"; }
aviso() { printf 'AVISO  %s\n' "$*"; avisos=$((avisos + 1)); }
erro()  { printf 'ERRO   %s\n' "$*"; erros=$((erros + 1)); }

printf 'VM: %s, IP de saida %s\n' "$(hostname -s)" "$(curl -fsS --max-time 8 https://api.ipify.org 2>/dev/null || echo '?')"
case "$(uname -m)" in aarch64|arm64) ok "ARM64" ;; *) erro "precisa ser ARM64, e $(uname -m)" ;; esac
for t in docker git python3 openssl curl flock ss; do command -v "$t" >/dev/null && ok "$t" || erro "falta $t"; done
docker info >/dev/null 2>&1 && ok "Docker acessivel" || erro "sem acesso ao Docker (rode com sudo)"
# gw_priority, usado pelo proxy do WhatsApp, veio no Docker 28 e no Compose 2.33
v=$(docker version -f '{{.Server.Version}}' 2>/dev/null); [ "${v%%.*}" -ge 28 ] 2>/dev/null && ok "Docker $v" || erro "Docker ${v:-?}: precisa do 28 ou mais novo"
v=$(docker compose version --short 2>/dev/null); v=${v#v}
printf '2.33\n%s\n' "${v:-0}" | sort -V -C && ok "Compose $v" || erro "Compose ${v:-?}: precisa do 2.33 ou mais novo"
livre=$(df -Pk /var/lib/docker 2>/dev/null | awk 'NR==2{print int($4/1048576)}'); [ "${livre:-0}" -ge 20 ] && ok "disco ${livre} GB livres" || erro "disco ${livre:-?} GB livres: reserve 20 GB"
mem=$(awk '/MemAvailable/{print int($2/1024)}' /proc/meminfo); [ "$mem" -ge 4096 ] && ok "memoria ${mem} MB livres" || aviso "memoria ${mem} MB livres: o build usa perto de 4 GB"
timedatectl show -p NTPSynchronized --value 2>/dev/null | grep -q yes && ok "relogio sincronizado" || aviso "relogio sem NTP: o WhatsApp recusa relogio errado"

for p in 5480 5481 5495 5496; do ss -ltnH "sport = :$p" 2>/dev/null | grep -q . && erro "porta $p ocupada" || ok "porta $p livre"; done
redes=$(docker network ls -q 2>/dev/null | xargs -r docker network inspect -f '{{.Name}} {{range .IPAM.Config}}{{.Subnet}} {{end}}' 2>/dev/null)
for n in 240 241 242 243 249 250 251 252; do
  grep -qE " 172\.29\.$n\." <<<"$redes" && erro "rede 172.29.$n.0/28 em uso: $(grep -E " 172\.29\.$n\." <<<"$redes" | head -1)"
done
grep -qE " 172\.(29|28|2[4-7])\.0\.0/(8|1[0-6])|172\.16\.0\.0/12" <<<"$redes" && aviso "ha rede larga em 172.x que pode cobrir 172.29: confira"
for p in superchat superchatdev superchatensaio superchatdevensaio; do
  [ -n "$(docker volume ls -q --filter "label=com.docker.compose.project=$p" 2>/dev/null)" ] && erro "ja ha volumes do projeto $p"
done

c80=$(ss -ltnpH "sport = :443" 2>/dev/null | grep -oE 'users:\(\("[^"]+' | head -1 | cut -d'"' -f2)
if docker ps --format '{{.Names}} {{.Image}}' 2>/dev/null | grep -qi traefik; then
  ok "Traefik em execucao (ZAPK_INGRESS=traefik)"
  docker network inspect coolify -f 'rede coolify: {{range .IPAM.Config}}{{.Subnet}} {{end}}' 2>/dev/null | sed 's/^/       /'
elif command -v caddy >/dev/null; then ok "Caddy no host (ZAPK_INGRESS=caddy)"
else aviso "sem Traefik nem Caddy; porta 443 com ${c80:-ninguem}"; fi
for h in github.com registry-1.docker.io ghcr.io registry.npmjs.org web.whatsapp.com mmg.whatsapp.net; do
  curl -sS -o /dev/null --max-time 10 "https://$h" 2>/dev/null && ok "alcanca $h" || erro "nao alcanca $h"
done
for h in superchat.komunick.com superchatdev.komunick.com; do printf 'DNS    %s -> %s\n' "$h" "$(getent ahostsv4 "$h" | awk 'NR==1{print $1}')"; done
printf '\n%s erro(s), %s aviso(s)\n' "$erros" "$avisos"
[ "$erros" = 0 ]
