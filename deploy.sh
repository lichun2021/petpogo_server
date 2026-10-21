#!/bin/bash
# =====================================================
set -o pipefail
# petpogo-server 一键构建 + 部署脚本
# 用法:
#   ./deploy.sh          # 构建并部署到服务器
#   ./deploy.sh --build  # 仅本地构建，不上传
# =====================================================

# ============ 配置（按需修改）============
SSH_HOST="115.29.196.61"           # 服务器 IP
SSH_USER="root"                    # 登录用户名
SSH_PORT="22"                      # SSH 端口
SSH_KEY="lc.pem"                   # 证书文件路径（相对或绝对路径）
REMOTE_PATH="/data/petpogo-server" # 服务器上的目录
PM2_NAME="petpogo-server"          # PM2 进程名
# =========================================

# 颜色
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
log_error()   { echo -e "${RED}[✗]${NC} $1"; exit 1; }
log_step()    { echo -e "\n${BOLD}${CYAN}>>> $1${NC}"; }

START_TIME=$(date +%s)
BUILD_ONLY=false
[ "$1" = "--build" ] && BUILD_ONLY=true

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ZIP_NAME="petpogo-server.zip"
REMOTE_BACKUP="$REMOTE_PATH/backups/$(date +%Y%m%d%H%M%S)-$$.tar.gz"

# 解析 SSH_KEY 为绝对路径（相对路径以脚本目录为基准）
if [[ "$SSH_KEY" != /* ]]; then
  SSH_KEY="$SCRIPT_DIR/$SSH_KEY"
fi

# 检查 pem 文件并自动修权限
if [ ! -f "$SSH_KEY" ]; then
  log_error "证书文件不存在: $SSH_KEY\n  请将 lc.pem 放在项目根目录，或修改脚本中 SSH_KEY 的路径"
fi
chmod 600 "$SSH_KEY" 2>/dev/null

# 重建 SSH_OPTS（使用绝对路径）
SSH_OPTS=(-i "$SSH_KEY" -o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=yes -p "$SSH_PORT")
SCP_OPTS=(-i "$SSH_KEY" -o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=yes -P "$SSH_PORT")

rollback_remote() {
  log_warn "部署失败，尝试恢复部署前的应用备份..."
  ssh "${SSH_OPTS[@]}" "$SSH_USER@$SSH_HOST" "
    set -euo pipefail
    cd '$REMOTE_PATH'
    test -f '$REMOTE_BACKUP' || { echo '尚未替换应用，无需恢复'; exit 0; }
    tar -tzf '$REMOTE_BACKUP' >/dev/null
    if pm2 describe '$PM2_NAME' >/dev/null 2>&1; then pm2 delete '$PM2_NAME'; fi
    rm -rf server public
    tar -xzf '$REMOTE_BACKUP' -C .
    NODE_ENV=production PORT=3000 NITRO_PORT=3000 NITRO_HOST=0.0.0.0 pm2 start '$REMOTE_PATH/server/scripts/start.mjs' --name '$PM2_NAME' --cwd '$REMOTE_PATH' --node-args='--env-file=$REMOTE_PATH/.env'
    for attempt in \$(seq 1 30); do
      if curl --max-time 2 -fsS http://127.0.0.1:3000/api/health/ready >/dev/null; then pm2 save; echo '旧版本已恢复'; exit 0; fi
      sleep 1
    done
    echo '恢复后健康检查失败，需要检查进程日志'; exit 1
  " || log_error "自动恢复失败，请使用 $REMOTE_BACKUP 恢复应用"
}

echo ""
echo -e "${BOLD}======================================${NC}"
echo -e "${BOLD}  petpogo-server 部署脚本 (Nuxt 4)${NC}"
echo -e "${BOLD}======================================${NC}"
echo -e "  本地路径 : ${CYAN}$SCRIPT_DIR${NC}"
echo -e "  目标服务器: ${CYAN}$SSH_HOST → $REMOTE_PATH${NC}"
echo -e "  PM2 进程  : ${CYAN}$PM2_NAME${NC}"
echo ""

cd "$SCRIPT_DIR" || log_error "无法进入项目目录"

# ── 步骤 1: 构建 ──────────────────────────────────
log_step "步骤 1/5 · 本地构建"
log_info "清理旧产物..."
rm -rf .output .nuxt

log_info "执行 npm run build..."
npm run build
[ $? -ne 0 ] && log_error "构建失败！请检查错误信息"
[ ! -d ".output" ] && log_error ".output 目录不存在，构建异常"
if [ -f .env ]; then
  npm run check:secrets || log_error "构建产物含敏感配置，停止部署"
fi
log_success "构建完成"

# 仅构建模式：到此结束
if [ "$BUILD_ONLY" = true ]; then
  echo -e "\n${GREEN}仅构建模式，跳过上传。产物在 .output/${NC}"
  exit 0
fi

# ── 步骤 2: 打包 ──────────────────────────────────
log_step "步骤 2/5 · 打包 .output + 运维脚本 + package.json"
rm -f "$ZIP_NAME"
# 打包启动包装和版本检查工具；保留服务器 .env，不用本地配置覆盖。
mkdir -p .output/server/scripts .output/server/migrations .output/server/sql || log_error "创建部署目录失败"
cp scripts/start.mjs scripts/runtime-env.mjs scripts/migrate.mjs .output/server/scripts/ || log_error "复制启动脚本失败"
cp migrations/*.mjs .output/server/migrations/ || log_error "复制迁移文件失败"
cp sql/patch-moment-schedule-settings.sql .output/server/sql/ || log_error "复制发布计划建表SQL失败"
(cd .output && zip -r "../$ZIP_NAME" . -q) || log_error "打包失败"
# 追加运维文件；环境配置仅保留在线上
zip -j "$ZIP_NAME" ecosystem.config.js package.json package-lock.json start.sh stop.sh restart.sh -q || log_error "打包运维文件失败"
ZIP_SIZE=$(du -sh "$ZIP_NAME" | cut -f1)
log_success "打包完成：$ZIP_NAME ($ZIP_SIZE)"

# ── 步骤 3: 上传 ──────────────────────────────────
log_step "步骤 3/5 · 上传到 $SSH_USER@$SSH_HOST"
ssh "${SSH_OPTS[@]}" "$SSH_USER@$SSH_HOST" "mkdir -p '$REMOTE_PATH'" || log_error "远程目录不可用"
scp "${SCP_OPTS[@]}" "$ZIP_NAME" "$SSH_USER@$SSH_HOST:$REMOTE_PATH/"
[ $? -ne 0 ] && log_error "上传失败，请检查 SSH 连接和证书 ($SSH_KEY)"
log_success "上传完成"

# ── 步骤 4: 服务器解压 ────────────────────────────
log_step "步骤 4/5 · 服务器解压 + 安装依赖"
if ! ssh "${SSH_OPTS[@]}" "$SSH_USER@$SSH_HOST" "
  set -euo pipefail
  cd $REMOTE_PATH
  test -f .env || { echo '缺少线上 .env，请先配置'; exit 1; }
  chmod 600 .env
  command -v pm2 >/dev/null
  stage=\$(mktemp -d '$REMOTE_PATH/.deploy-incoming.XXXXXX')
  trap 'rm -rf \"\$stage\"' EXIT
  unzip -tq '$ZIP_NAME'
  unzip -oq '$ZIP_NAME' -d \"\$stage\"
  test -f \"\$stage/server/scripts/runtime-env.mjs\"
  # 在停服务之前检查本次部署所需的数据库版本。
  node \"\$stage/server/scripts/migrate.mjs\" --check
  mkdir -p backups
  chmod 700 backups
  backup_files=()
  for candidate in server public ecosystem.config.js package.json package-lock.json start.sh stop.sh restart.sh; do
    if [ -e \"\$candidate\" ]; then backup_files+=(\"\$candidate\"); fi
  done
  tar -czf '$REMOTE_BACKUP' \"\${backup_files[@]}\"
  chmod 600 '$REMOTE_BACKUP'
  echo '旧版本已备份: $REMOTE_BACKUP'
  if pm2 describe '$PM2_NAME' >/dev/null 2>&1; then pm2 stop '$PM2_NAME'; fi
  echo '替换应用产物，保留配置和历史发布目录...'
  rm -rf server public
  cp -a \"\$stage/.\" .
  rm -f $ZIP_NAME
  echo '解压完成'

  # 如果有 package.json，安装生产依赖
  if [ -f package.json ]; then
    echo '安装依赖（sharp 等）...'
    npm install --include=optional --production --no-save sharp 2>&1 | tail -5
    echo '依赖安装完成'
  fi
"; then
  rollback_remote
  log_error "服务器解压或依赖安装失败"
fi
log_success "解压和依赖安装完成"

# ── 步骤 5: 重启 PM2 ─────────────────────────────
log_step "步骤 5/5 · 重启 PM2 ($PM2_NAME)"
if ! ssh "${SSH_OPTS[@]}" "$SSH_USER@$SSH_HOST" "
  set -euo pipefail
  cd '$REMOTE_PATH'
  node server/scripts/migrate.mjs --check
  # restart 会保留旧路径；重新注册为实际部署目录的入口。
  if pm2 describe '$PM2_NAME' >/dev/null 2>&1; then pm2 delete '$PM2_NAME'; fi
  NODE_ENV=production PORT=3000 NITRO_PORT=3000 NITRO_HOST=0.0.0.0 pm2 start '$REMOTE_PATH/server/scripts/start.mjs' --name '$PM2_NAME' --cwd '$REMOTE_PATH' --node-args='--env-file=$REMOTE_PATH/.env'
  healthy=false
  for attempt in \$(seq 1 30); do
    if curl --max-time 2 -fsS http://127.0.0.1:3000/api/health/ready >/dev/null; then healthy=true; break; fi
    sleep 1
  done
  \"\$healthy\" || { echo '健康检查失败，请检查 PM2 日志'; exit 1; }
  pm2 save
"; then
  rollback_remote
  log_error "启动或健康检查失败，已尝试恢复旧版本"
fi
log_success "PM2 重启完成"

# ── 清理本地 zip ──────────────────────────────────
rm -f "$ZIP_NAME"

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo ""
echo -e "${BOLD}======================================${NC}"
echo -e "${GREEN}${BOLD}  部署成功！✓${NC}"
echo -e "  耗时: $((ELAPSED/60))m $((ELAPSED%60))s"
echo -e "  访问: http://${SSH_HOST}:3000"
echo -e "${BOLD}======================================${NC}"
echo ""
