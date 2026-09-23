#!/bin/bash
# 本地校验后发布到独立目录。默认只检查数据库；--migrate 明确执行待升级迁移。
set -euo pipefail
SSH_HOST="115.29.196.61"
SSH_USER="root"
REMOTE_PATH="/data/petpogo-server"
PM2_NAME="petpogo-server"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_ONLY=false
MIGRATE=false
for arg in "$@"; do
  case "$arg" in --build) BUILD_ONLY=true ;; --migrate) MIGRATE=true ;; *) echo "未知参数: $arg"; exit 1 ;; esac
done
cd "$SCRIPT_DIR"
npm run check
if "$BUILD_ONLY"; then echo '构建与检查完成'; exit 0; fi
SSH_KEY="$SCRIPT_DIR/lc.pem"
test -f "$SSH_KEY" || { echo '缺少部署 SSH key'; exit 1; }
RELEASE_ID="$(date -u +%Y%m%d%H%M%S)-$RANDOM"
mkdir -p .output/server/scripts .output/server/migrations
cp scripts/migrate.mjs scripts/start.mjs .output/server/scripts/
cp migrations/*.mjs .output/server/migrations/
ARCHIVE="$(mktemp /tmp/petpogo-release.XXXXXX)"
trap 'rm -f "$ARCHIVE"' EXIT
# macOS 的扩展属性/AppleDouble 元数据不属于部署文件，避免 Linux 解压警告。
# 按 tar 实现区分参数，兼容 macOS bsdtar 和 Linux GNU tar。
TAR_METADATA_FLAGS=()
if [[ "$(tar --version)" == *bsdtar* ]]; then
  TAR_METADATA_FLAGS=(--no-xattrs --no-acls --no-fflags --no-mac-metadata)
fi
COPYFILE_DISABLE=1 tar -czf "$ARCHIVE" "${TAR_METADATA_FLAGS[@]}" -C .output .
# 使用已有 known_hosts，不自动跳过服务器身份验证。
ssh -i "$SSH_KEY" -o BatchMode=yes "$SSH_USER@$SSH_HOST" "mkdir -p '$REMOTE_PATH/releases/$RELEASE_ID' '$REMOTE_PATH/shared'"
scp -i "$SSH_KEY" -o BatchMode=yes "$ARCHIVE" "$SSH_USER@$SSH_HOST:$REMOTE_PATH/releases/$RELEASE_ID/release.tar.gz"
ssh -i "$SSH_KEY" -o BatchMode=yes "$SSH_USER@$SSH_HOST" bash -s -- "$REMOTE_PATH" "$RELEASE_ID" "$PM2_NAME" "$MIGRATE" <<'REMOTE'
set -euo pipefail
base="$1"; release="$base/releases/$2"; name="$3"; migrate="$4"
cd "$release"
tar -xzf release.tar.gz
rm release.tar.gz
# 配置与发布包分离；第一次升级沿用服务器已有配置。
if [ ! -f "$base/shared/.env" ] && [ -f "$base/.env" ]; then
  cp "$base/.env" "$base/shared/.env"
  chmod 600 "$base/shared/.env"
fi
test -f "$base/shared/.env" || { echo '请先配置 shared/.env'; exit 1; }
ln -s "$base/shared/.env" .env
command -v pm2 >/dev/null
previous="$(readlink "$base/current" || true)"
old_exists=false
if pm2 describe "$name" >/dev/null 2>&1; then old_exists=true; fi
# 不自动恢复到旧账务写入代码：迁移之后失败时保持停机，按恢复说明选择兼容版本。
if [ "$migrate" = true ]; then
  echo '即将迁移；请确认外部周期任务已暂停，数据库备份已完成。'
  if "$old_exists"; then pm2 stop "$name"; fi
  node server/scripts/migrate.mjs
else
  node server/scripts/migrate.mjs --check
fi
# 只读健康探针；不触发登录、消费或其他业务写入。
NODE_ENV=production PORT=3101 NITRO_PORT=3101 NITRO_HOST=127.0.0.1 node --env-file=.env server/scripts/start.mjs > preflight.log 2>&1 &
candidate=$!
trap 'kill "$candidate" 2>/dev/null || true' EXIT
ready=false
for attempt in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3101/api/health/ready >/dev/null; then ready=true; break; fi
  kill -0 "$candidate" 2>/dev/null || break
  sleep 1
done
"$ready" || { echo '新版本健康检查失败，未切换；检查 preflight.log'; exit 1; }
kill "$candidate"; wait "$candidate" 2>/dev/null || true
trap - EXIT
if "$old_exists"; then pm2 stop "$name"; fi
ln -sfn "$release" "$base/current.next"
mv -Tf "$base/current.next" "$base/current"
if "$old_exists"; then pm2 delete "$name"; fi
NODE_ENV=production PORT=3000 NITRO_HOST=0.0.0.0 pm2 start server/scripts/start.mjs --name "$name" --cwd "$release" --node-args="--env-file=$base/shared/.env"
healthy=false
for attempt in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3000/api/health/ready >/dev/null; then healthy=true; break; fi
  sleep 1
done
"$healthy" || { echo "新进程健康检查失败；上一发布目录: $previous。不要回退到旧账务/默认密码代码。"; exit 1; }
pm2 save
echo "发布完成: $release"
REMOTE
