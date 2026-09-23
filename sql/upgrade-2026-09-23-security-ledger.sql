-- 2026-09-23：已有 petpogo 数据库升级（MySQL 8.0+）
-- 先备份、暂停外部积分任务并停止旧服务；在客户端明确选择目标数据库后执行整份文件。
-- 不要对已有库执行 init.sql；本文件不创建数据库、不删除业务表。
-- 本文件与 migrations/001-security-ledger.mjs 对应，字段已存在时跳过添加。
-- 手工执行后仍必须运行部署脚本 --migrate：由正式迁移器复核、记录校验和，才能通过健康检查。
-- 不要手工插入 t_schema_migration，不要使用忽略 SQL 错误继续执行的模式。
SET time_zone = '+08:00';


ALTER TABLE t_user MODIFY COLUMN password VARCHAR(255) NULL;

SET @petpogo_upgrade_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='t_user' AND COLUMN_NAME='credential_version'),
  'SELECT 1',
  'ALTER TABLE t_user ADD COLUMN credential_version INT UNSIGNED NOT NULL DEFAULT 0'
);
PREPARE petpogo_upgrade_stmt FROM @petpogo_upgrade_sql;
EXECUTE petpogo_upgrade_stmt;
DEALLOCATE PREPARE petpogo_upgrade_stmt;

UPDATE t_user SET password=NULL,credential_version=credential_version+1 WHERE credential_version=0 AND (password IS NULL OR password='' OR password=MD5('123456'));

CREATE TABLE IF NOT EXISTS t_points_operation (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    source VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    event_id VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    user_id BIGINT NOT NULL, request_hash CHAR(64) NOT NULL,
    amount INT NULL, rule_snapshot JSON NULL, result JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_source_event(source,event_id), INDEX idx_user(user_id)
  ) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS t_pet_model_assignment (
    id TINYINT PRIMARY KEY,default_model_id BIGINT NULL,default_cat_model_id BIGINT NULL,default_dog_model_id BIGINT NULL,
    rules JSON NOT NULL,breed_mappings JSON NOT NULL,revision INT UNSIGNED NOT NULL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB;

SET @petpogo_upgrade_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='t_pet_model_assignment' AND COLUMN_NAME='default_cat_model_id'),
  'SELECT 1',
  'ALTER TABLE t_pet_model_assignment ADD COLUMN default_cat_model_id BIGINT NULL'
);
PREPARE petpogo_upgrade_stmt FROM @petpogo_upgrade_sql;
EXECUTE petpogo_upgrade_stmt;
DEALLOCATE PREPARE petpogo_upgrade_stmt;

SET @petpogo_upgrade_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='t_pet_model_assignment' AND COLUMN_NAME='default_dog_model_id'),
  'SELECT 1',
  'ALTER TABLE t_pet_model_assignment ADD COLUMN default_dog_model_id BIGINT NULL'
);
PREPARE petpogo_upgrade_stmt FROM @petpogo_upgrade_sql;
EXECUTE petpogo_upgrade_stmt;
DEALLOCATE PREPARE petpogo_upgrade_stmt;

SET @petpogo_upgrade_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='t_pet_model_assignment' AND COLUMN_NAME='revision'),
  'SELECT 1',
  'ALTER TABLE t_pet_model_assignment ADD COLUMN revision INT UNSIGNED NOT NULL DEFAULT 0'
);
PREPARE petpogo_upgrade_stmt FROM @petpogo_upgrade_sql;
EXECUTE petpogo_upgrade_stmt;
DEALLOCATE PREPARE petpogo_upgrade_stmt;

SET @petpogo_upgrade_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='t_pet' AND COLUMN_NAME='model_snapshot'),
  'SELECT 1',
  'ALTER TABLE t_pet ADD COLUMN model_snapshot JSON NULL'
);
PREPARE petpogo_upgrade_stmt FROM @petpogo_upgrade_sql;
EXECUTE petpogo_upgrade_stmt;
DEALLOCATE PREPARE petpogo_upgrade_stmt;

SET @petpogo_upgrade_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='t_pet' AND COLUMN_NAME='model_assignment_source'),
  'SELECT 1',
  'ALTER TABLE t_pet ADD COLUMN model_assignment_source VARCHAR(20) NULL'
);
PREPARE petpogo_upgrade_stmt FROM @petpogo_upgrade_sql;
EXECUTE petpogo_upgrade_stmt;
DEALLOCATE PREPARE petpogo_upgrade_stmt;

SET @petpogo_upgrade_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='t_pet' AND COLUMN_NAME='model_rule_name'),
  'SELECT 1',
  'ALTER TABLE t_pet ADD COLUMN model_rule_name VARCHAR(100) NULL'
);
PREPARE petpogo_upgrade_stmt FROM @petpogo_upgrade_sql;
EXECUTE petpogo_upgrade_stmt;
DEALLOCATE PREPARE petpogo_upgrade_stmt;

SET @petpogo_upgrade_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='t_pet' AND COLUMN_NAME='model_assigned_at'),
  'SELECT 1',
  'ALTER TABLE t_pet ADD COLUMN model_assigned_at DATETIME NULL'
);
PREPARE petpogo_upgrade_stmt FROM @petpogo_upgrade_sql;
EXECUTE petpogo_upgrade_stmt;
DEALLOCATE PREPARE petpogo_upgrade_stmt;

INSERT IGNORE INTO t_pet_model_assignment(id,rules,breed_mappings) VALUES(1,JSON_ARRAY(),JSON_ARRAY());

UPDATE t_pet p JOIN t_pet_model m ON m.id=p.model_id SET p.model_snapshot=JSON_OBJECT('id',CAST(m.id AS CHAR),'name',m.name,'glb_url',m.glb_url,'thumbnail_url',m.thumbnail_url),p.model_assignment_source='legacy',p.model_assigned_at=NOW() WHERE p.model_snapshot IS NULL;

-- 下一步：运行 ./deploy.sh --migrate（推荐），或在对应版本目录执行迁移器完成版本登记。
