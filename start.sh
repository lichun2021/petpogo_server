#!/bin/bash
# ── 启动 petpogo-server ──────────────────────────
APP="petpogo-server"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "[start] 启动 $APP ..."

# 确保日志目录存在
mkdir -p /data/logs

# 加载 nvm（如果用 nvm 管理 Node）
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

if pm2 list 2>/dev/null | grep -q "$APP"; then
  echo "[start] 进程已存在，执行 restart..."
  pm2 restart "$APP"
else
  echo "[start] 首次启动..."
  cd "$DIR"
  pm2 start ecosystem.config.js
fi

pm2 save
echo "[start] ✓ $APP 已启动，端口 3000"
pm2 list | grep "$APP"
