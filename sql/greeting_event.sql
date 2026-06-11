-- 打招呼事件表（2026-06-11）
-- 用户主动打招呼：App发送招呼音 → 设备播放 → 录制宠物响应 → AI情绪分析
CREATE TABLE IF NOT EXISTS t_greeting_event (
  id            BIGINT        PRIMARY KEY AUTO_INCREMENT,
  user_id       BIGINT        NOT NULL    COMMENT '用户ID（发起打招呼的用户）',
  device_id     VARCHAR(50)   NOT NULL    COMMENT '设备MAC地址',
  greet_url     TEXT          COMMENT '招呼音频URL（用户发给设备的音频）',
  response_url  TEXT          COMMENT '宠物响应资源URL（设备录制的视频/音频）',
  cover_url     VARCHAR(500)  COMMENT '响应视频封面URL',
  ai_result     JSON          COMMENT 'AI情绪分析结果（JSON）',
  status        TINYINT       DEFAULT 1   COMMENT '1正常 0已删除',
  created_at    DATETIME      DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id   (user_id),
  INDEX idx_device_id (device_id),
  INDEX idx_created_at(created_at)
) ENGINE=InnoDB COMMENT='用户打招呼事件表';
