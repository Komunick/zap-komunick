#!/usr/bin/env bash
# Instala o operador de deploy na VM de destino. Nao sobe ambiente, nao mexe em DNS nem no
# proxy e nao liga o poller. Requer $ZAPK_ROOT/host.env preenchido.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "rode com sudo" >&2; exit 1; }
ACTION=instalar
aqui=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=common.sh
source "$aqui/common.sh"
carregar_host
mkdir -p "$BIN" "$STATE" "$ROOT/exports"
install -m 0755 "$aqui/"{zapk,importar,exportar,preflight}.sh "$BIN/"
install -m 0644 "$aqui/common.sh" "$aqui/"override.*.yaml "$BIN/"
install -m 0444 "$aqui/../arm04/whatsapp-connect-proxy.cjs" "$BIN/whatsapp-connect-proxy.cjs"
[ -f "$ROOT/branch" ] || echo dev > "$ROOT/branch"
[ -d "$CHECKOUT/.git" ] || git clone -q "$ZAPK_REPO" "$CHECKOUT"
if [ "$ROOT" = /opt/zap-komunick ]; then
  install -m 0644 "$aqui/zapk-poller.service" "$aqui/zapk-poller.timer" /etc/systemd/system/
  systemctl daemon-reload
fi
echo "Instalado em $BIN. O poller so e ligado depois da virada:"
echo "  systemctl enable --now zapk-poller.timer"
