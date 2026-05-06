#!/bin/bash
# =====================================================
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

# SSH / SCP 公共参数
SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=no -p $SSH_PORT"
SCP_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=no -P $SSH_PORT"

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
SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=no -p $SSH_PORT"
SCP_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=no -P $SSH_PORT"

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
log_success "构建完成"

# 仅构建模式：到此结束
if [ "$BUILD_ONLY" = true ]; then
  echo -e "\n${GREEN}仅构建模式，跳过上传。产物在 .output/${NC}"
  exit 0
fi

# ── 步骤 2: 打包 ──────────────────────────────────
log_step "步骤 2/5 · 打包 .output + 运维脚本"
rm -f "$ZIP_NAME"
# 打包 .output 目录内容 + 根目录的运维文件和环境变量文件
(cd .output && zip -r "../$ZIP_NAME" . -q)
# 追加 .env, ecosystem 和 shell 脚本到 zip 根目录
zip -j "$ZIP_NAME" .env ecosystem.config.js start.sh stop.sh restart.sh -q 2>/dev/null || true
ZIP_SIZE=$(du -sh "$ZIP_NAME" | cut -f1)
log_success "打包完成：$ZIP_NAME ($ZIP_SIZE)"

# ── 步骤 3: 上传 ──────────────────────────────────
log_step "步骤 3/5 · 上传到 $SSH_USER@$SSH_HOST"
ssh $SSH_OPTS $SSH_USER@$SSH_HOST "mkdir -p $REMOTE_PATH"
scp $SCP_OPTS "$ZIP_NAME" "$SSH_USER@$SSH_HOST:$REMOTE_PATH/"
[ $? -ne 0 ] && log_error "上传失败，请检查 SSH 连接和证书 ($SSH_KEY)"
log_success "上传完成"

# ── 步骤 4: 服务器解压 ────────────────────────────
log_step "步骤 4/5 · 服务器解压"
ssh $SSH_OPTS $SSH_USER@$SSH_HOST "
  set -e
  cd $REMOTE_PATH
  echo '清理旧文件...'
  find . -type f ! -name '$ZIP_NAME' -delete 2>/dev/null || true
  find . -mindepth 1 -type d -empty -delete 2>/dev/null || true
  unzip -oq $ZIP_NAME -d .
  rm -f $ZIP_NAME
  echo '解压完成'
"
[ $? -ne 0 ] && log_error "服务器解压失败"
log_success "解压完成"

# ── 步骤 5: 重启 PM2 ─────────────────────────────
log_step "步骤 5/5 · 重启 PM2 ($PM2_NAME)"
ssh $SSH_OPTS $SSH_USER@$SSH_HOST "
  if ! command -v pm2 &>/dev/null; then
    echo '[WARN] pm2 未安装，请先在服务器执行: npm i -g pm2'
    exit 0
  fi
  if pm2 list | grep -q '$PM2_NAME'; then
    pm2 restart $PM2_NAME
  else
    echo '首次启动 $PM2_NAME...'
    cd $REMOTE_PATH
    PORT=3000 pm2 start server/index.mjs --name $PM2_NAME
  fi
  pm2 save
"
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
