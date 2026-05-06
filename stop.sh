#!/bin/bash
# ── 停止 petpogo-server ──────────────────────────
APP="petpogo-server"

echo "[stop] 停止 $APP ..."

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

if pm2 list 2>/dev/null | grep -q "$APP"; then
  pm2 stop "$APP"
  echo "[stop] ✓ $APP 已停止"
else
  echo "[stop] $APP 未在运行"
fi
