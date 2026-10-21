#!/bin/bash
# ── 启动 petpogo-server ──────────────────────────
APP="petpogo-server"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "[start] 启动 $APP ..."

# 确保日志目录存在
mkdir -p /data/logs

# 加载 nvm（如果用 nvm 管理 Node）
test -f "$DIR/.env" && test -f "$DIR/server/scripts/runtime-env.mjs" || { echo "缺少线上环境文件或启动脚本，请先部署新版本"; exit 1; }

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

if pm2 describe "$APP" >/dev/null 2>&1; then
  echo "[start] 进程已存在，执行 restart..."
  pm2 restart "$APP"
else
  echo "[start] 首次启动..."
  cd "$DIR"
  pm2 start "$DIR/server/scripts/start.mjs" --name "$APP" --cwd "$DIR" --node-args="--env-file=$DIR/.env"
fi

pm2 save
echo "[start] ✓ $APP 已启动，端口 3000"
pm2 list | grep "$APP"
