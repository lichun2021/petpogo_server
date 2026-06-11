-- 自动抓拍事件表（2026-06-11）
-- 由设备触发：定时抓拍 / 移动检测 / 计划任务
CREATE TABLE IF NOT EXISTS t_capture_event (
  id            BIGINT        PRIMARY KEY AUTO_INCREMENT,
  user_id       BIGINT        NOT NULL    COMMENT '用户ID',
  device_id     VARCHAR(50)   NOT NULL    COMMENT '设备MAC地址',
  event_type    VARCHAR(50)   NOT NULL    DEFAULT 'auto_capture'
                              COMMENT '事件类型: auto_capture / motion / scheduled',
  resource_url  TEXT          COMMENT '资源URL（视频/音频/图片，OSS直链）',
  cover_url     VARCHAR(500)  COMMENT '封面/缩略图URL',
  ai_result     JSON          COMMENT 'AI情绪分析结果（JSON）',
  status        TINYINT       DEFAULT 1   COMMENT '1正常 0已删除',
  created_at    DATETIME      DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id   (user_id),
  INDEX idx_device_id (device_id),
  INDEX idx_event_type(event_type),
  INDEX idx_created_at(created_at)
) ENGINE=InnoDB COMMENT='设备自动抓拍事件表';
