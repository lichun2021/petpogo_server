-- AI 分析结果表迁移脚本
-- 新建数据库直接用 init.sql；已有数据库执行此脚本
USE petpogo;

-- =====================================================
-- 音频情绪分析结果表
-- 对应 AI 接口：POST /voice/analyze
-- =====================================================
CREATE TABLE IF NOT EXISTS t_pet_voice_analysis (
  id              BIGINT        PRIMARY KEY AUTO_INCREMENT,
  user_id         BIGINT        NOT NULL                   COMMENT '用户ID',
  pet_id          BIGINT                                   COMMENT '宠物ID（可空）',
  audio_url       VARCHAR(500)  NOT NULL                   COMMENT 'OSS音频URL',
  species         VARCHAR(20)                              COMMENT '识别物种 cat/dog',
  species_conf    DECIMAL(5,4)                             COMMENT '物种置信度',
  emotion         VARCHAR(50)                              COMMENT '主情绪标签(英文)',
  emotion_zh      VARCHAR(50)                              COMMENT '主情绪标签(中文)',
  emotion_conf    DECIMAL(5,4)                             COMMENT '主情绪置信度',
  top3            JSON                                     COMMENT 'top3情绪 [{label,label_zh,confidence}]',
  all_predictions JSON                                     COMMENT '全部情绪预测分值',
  advice          TEXT                                     COMMENT 'AI建议文字',
  processing_ms   INT                                      COMMENT 'AI处理耗时(ms)',
  raw_result      JSON                                     COMMENT 'AI原始响应（备查）',
  created_at      DATETIME      DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user   (user_id),
  INDEX idx_pet    (pet_id),
  INDEX idx_created(created_at)
) ENGINE=InnoDB COMMENT='宠物音频情绪分析记录';

-- =====================================================
-- 图片情绪分析结果表
-- 对应 AI 接口：POST /dog-image/analyze
-- =====================================================
CREATE TABLE IF NOT EXISTS t_pet_image_analysis (
  id              BIGINT        PRIMARY KEY AUTO_INCREMENT,
  user_id         BIGINT        NOT NULL                   COMMENT '用户ID',
  pet_id          BIGINT                                   COMMENT '宠物ID（可空）',
  image_url       VARCHAR(500)  NOT NULL                   COMMENT 'OSS图片URL',
  emotion         VARCHAR(50)                              COMMENT '主情绪标签(英文)',
  emotion_zh      VARCHAR(50)                              COMMENT '主情绪标签(中文)',
  emotion_conf    DECIMAL(5,4)                             COMMENT '主情绪置信度',
  top3            JSON                                     COMMENT 'top3情绪 [{label,label_zh,confidence}]',
  all_predictions JSON                                     COMMENT '全部13类情绪预测分值',
  advice          TEXT                                     COMMENT 'AI建议文字',
  ensemble_size   TINYINT                                  COMMENT '集成模型数量',
  processing_ms   INT                                      COMMENT 'AI处理耗时(ms)',
  raw_result      JSON                                     COMMENT 'AI原始响应（备查）',
  created_at      DATETIME      DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user   (user_id),
  INDEX idx_pet    (pet_id),
  INDEX idx_created(created_at)
) ENGINE=InnoDB COMMENT='宠物图片情绪分析记录';

SELECT 'Migration complete: t_pet_voice_analysis, t_pet_image_analysis' AS result;
