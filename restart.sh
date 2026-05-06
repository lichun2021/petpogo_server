#!/bin/bash
# ── 重启 petpogo-server ──────────────────────────
APP="petpogo-server"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "[restart] 重启 $APP ..."

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

if pm2 list 2>/dev/null | grep -q "$APP"; then
  pm2 restart "$APP"
  echo "[restart] ✓ $APP 重启完成"
else
  echo "[restart] 进程不存在，执行首次启动..."
  cd "$DIR"
  pm2 start ecosystem.config.js
fi

pm2 save
pm2 list | grep "$APP"
