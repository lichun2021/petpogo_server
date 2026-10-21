#!/bin/bash
# ── 重启 petpogo-server ──────────────────────────
APP="petpogo-server"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "[restart] 重启 $APP ..."

test -f "$DIR/.env" && test -f "$DIR/server/scripts/runtime-env.mjs" || { echo "缺少线上环境文件或启动脚本，请先部署新版本"; exit 1; }

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

if pm2 describe "$APP" >/dev/null 2>&1; then
  pm2 restart "$APP"
  echo "[restart] ✓ $APP 重启完成"
else
  echo "[restart] 进程不存在，执行首次启动..."
  cd "$DIR"
  pm2 start "$DIR/server/scripts/start.mjs" --name "$APP" --cwd "$DIR" --node-args="--env-file=$DIR/.env"
fi

pm2 save
pm2 list | grep "$APP"
