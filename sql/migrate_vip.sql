-- 已有数据库执行此迁移脚本（新建数据库直接用 init.sql）
USE petpogo;

-- =====================================================
-- 用存储过程安全地添加列（MySQL 8.0 兼容写法）
-- =====================================================
DROP PROCEDURE IF EXISTS _add_col;

DELIMITER $$
CREATE PROCEDURE _add_col()
BEGIN
  -- vip_status
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_user' AND COLUMN_NAME = 'vip_status'
  ) THEN
    ALTER TABLE t_user ADD COLUMN vip_status TINYINT DEFAULT 0 COMMENT '0普通 1VIP' AFTER status;
  END IF;

  -- vip_expire_at
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_user' AND COLUMN_NAME = 'vip_expire_at'
  ) THEN
    ALTER TABLE t_user ADD COLUMN vip_expire_at DATETIME NULL COMMENT 'VIP到期时间，NULL=永久' AFTER vip_status;
  END IF;

  -- ai_daily_limit
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_user' AND COLUMN_NAME = 'ai_daily_limit'
  ) THEN
    ALTER TABLE t_user ADD COLUMN ai_daily_limit INT DEFAULT 10 COMMENT '每日AI调用上限，-1=无限制' AFTER vip_expire_at;
  END IF;

  -- 索引 idx_vip
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_user' AND INDEX_NAME = 'idx_vip'
  ) THEN
    ALTER TABLE t_user ADD INDEX idx_vip (vip_status);
  END IF;
END$$
DELIMITER ;

CALL _add_col();
DROP PROCEDURE IF EXISTS _add_col;

-- =====================================================
-- 创建 AI 使用量表
-- =====================================================
CREATE TABLE IF NOT EXISTS t_ai_usage (
  id         BIGINT   PRIMARY KEY AUTO_INCREMENT,
  user_id    BIGINT   NOT NULL,
  use_date   DATE     NOT NULL  COMMENT '使用日期',
  used_count INT      DEFAULT 0 COMMENT '当日已使用次数',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_date (user_id, use_date),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB;

-- 验证
SELECT
  COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT, COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 't_user'
  AND COLUMN_NAME IN ('vip_status','vip_expire_at','ai_daily_limit');

SELECT 'Migration complete' AS result;
