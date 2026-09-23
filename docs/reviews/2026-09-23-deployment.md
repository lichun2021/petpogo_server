# 新版本部署步骤（已有生产库）

本次提供两种数据库升级入口：推荐使用 `./deploy.sh --migrate` 自动升级；需要 DBA 审核或手工操作时，可先执行 `sql/upgrade-2026-09-23-security-ledger.sql`。它们对应相同变更，不是两个独立升级。已有数据库不要执行 `sql/init.sql`。

后续调整：新注册账号已恢复初始密码 `123456`（加盐哈希存储）。已完成 001 迁移的服务器发布此调整使用 `./deploy.sh` 即可，无新增数据库变更；历史空密码账号不自动批量重置。

## 1. 发布前准备

- 确认 App 支持短信设置密码（purpose=password_reset）及重新登录；AI 消费上报已携带稳定 refId。
- 服务器 Node 必须支持 `node --env-file` 和 `process.loadEnvFile`；确认 MySQL 8.0+、Redis、PM2 正常，3000 为应用端口，3101 空闲用于预检。
- 暂停外部积分 cron 和消费上报，进入维护窗口，等待在途业务结束。脚本只停止本应用 PM2，不能替你暂停外部任务。
- 用既有备份工具完整备份生产库和服务器配置，确认备份可恢复。不要只备份本次修改的表。
- 在服务器检查 `/data/petpogo-server/shared/.env`；首次发布尚无此文件时，脚本从 `/data/petpogo-server/.env` 复制。已有 shared/.env 时，以它为准。本地 .env 不会上传。
- 必须显式配置 JWT_SECRET、APP_API_SECRET、OPENAPI_KEY、OPENAPI_SECRET（各至少16字符），以及实际 MYSQL_*、REDIS_* 和业务集成配置；源码中的默认密钥已移除。空管理员表还需至少12字符的 ADMIN_PASSWORD。轮换共享签名密钥需同步调用方。
- 调用方还未完成 v2 联调时，保留 SIGNATURE_V2_REQUIRED=false、OPENAPI_SIGNATURE_V2_REQUIRED=false；联调后再开启。这段兼容期仍存在旧签名风险。
- 本地准备 lc.pem，确认 SSH known_hosts 中服务器身份已核对；不要通过关闭主机校验来跳过。

## 2. 推荐：本地一条命令部署和迁移

在本地项目根目录执行：

```bash
./deploy.sh --migrate
```

脚本自动执行测试、类型检查、构建，上传到独立 releases 目录，停止旧服务，运行数据库迁移，再启动备用进程检查。检查通过后切换 current 并由 PM2 启动新版本。此流程有停机窗口。

**不需要先手工运行 SQL。** 数据库迁移由 `migrations/001-security-ledger.mjs` 执行，成功后记录版本和校验和。普通 `./deploy.sh` 只检查数据库版本，本次首次升级不能只执行普通部署。

## 3. 可选：先手工执行 SQL

仅在需要人工执行数据库变更时使用：

1. 完成第1步，服务器执行 `pm2 stop petpogo-server`，确认没有其他实例继续写库。
2. 将 `sql/upgrade-2026-09-23-security-ledger.sql` 上传给数据库操作者，在数据库客户端明确选择实际生产库（默认 petpogo），完整执行该文件。命令行示例中的大写参数需要替换，不把密码写入命令行：

   ```bash
   mysql --host=DB_HOST --user=DB_USER --password --database=petpogo < sql/upgrade-2026-09-23-security-ledger.sql
   ```

3. 任一语句失败都停止上线并检查原因；MySQL DDL 不会整批回滚。脚本检查字段是否存在，可以在修正原因后续跑。不要使用 mysql --force 忽略错误。
4. 返回本地项目，仍执行 `./deploy.sh --migrate`。正式迁移器会重复检查兼容变更并登记版本校验和，重复执行不会重复发积分或覆盖猫狗默认配置。

**手工 SQL 不写迁移版本表。仅执行 SQL 后直接启动新服务，健康检查仍可能失败。不要手工伪造迁移记录。**

SQL 会扩容密码字段、添加凭证版本和消费幂等表、补齐 GLB 配置表/字段及宠物快照字段；默认或空密码旧账号被要求重新短信登录。它不为你选择猫狗默认模型、不补发历史积分。

## 4. 上线检查

在服务器执行：

```bash
cd /data/petpogo-server/current
node server/scripts/migrate.mjs --check
curl -fsS http://127.0.0.1:3000/api/health/ready
pm2 status petpogo-server
pm2 logs petpogo-server --lines 100 --nostream
```

预期数据库版本检查通过，健康接口返回 `{"ready":true}`，PM2 状态 online。

随后验证：后台登录及形象分配配置可读取；分别选择猫、狗默认 GLB 并保存；创建测试猫狗确认匹配/保底；App 短信登录、签到、余额、设备读取正常；用联调事件确认 AI 重试不重复扣款。测试使用测试账号和事件，避免给真实用户制造积分记录。

确认无误后恢复外部任务与业务流量。日常重启用 `pm2 restart petpogo-server`，不要用旧 ecosystem.config.js 重新注册旧入口。今后无新增迁移时使用 `./deploy.sh`。

## 5. 失败时处理

- 本地检查或上传失败：修复原因后重试。
- 数据库升级失败：保持维护状态，检查具体 SQL/权限/字段差异；不要启动旧账务代码继续写入。
- 预检失败：检查本次 `/data/petpogo-server/releases/<发布编号>/preflight.log`。迁移模式中旧服务已停，不会自动恢复。
- 正式进程启动失败：查看 PM2 日志，修复配置或发布兼容新库的修复版本。不要直接退回接受默认密码或旧积分事务的版本。

本步骤文档和 SQL 已在本地准备；没有代你连接生产数据库或执行部署。
