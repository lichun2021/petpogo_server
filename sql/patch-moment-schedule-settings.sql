-- 服务启动和首次读写会自动建表；账号没有DDL权限时，由数据库管理员执行本文件。
-- 在现有业务数据库执行。不要插入配置行，首次保存前继续使用环境默认值。
CREATE TABLE IF NOT EXISTS t_moment_schedule_settings (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  enabled TINYINT NOT NULL,
  image_times JSON NOT NULL,
  text_times JSON NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_moment_schedule_singleton CHECK (id=1),
  CONSTRAINT chk_moment_schedule_enabled CHECK (enabled IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='宠物圈全局定时发送计划';
