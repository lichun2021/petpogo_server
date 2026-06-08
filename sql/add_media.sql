-- 用户图库表
-- 执行方式：mysql -u root -p petpogo < sql/add_media.sql

USE petpogo;

CREATE TABLE IF NOT EXISTS t_media (
  id         BIGINT        PRIMARY KEY AUTO_INCREMENT,
  user_id    BIGINT        NOT NULL                    COMMENT '上传用户ID',
  device_id  BIGINT        DEFAULT NULL                COMMENT '关联设备ID（t_device.id）',
  nickname   VARCHAR(50)   NOT NULL DEFAULT ''         COMMENT '上传时快照昵称',
  type       TINYINT       NOT NULL DEFAULT 1          COMMENT '类型: 1图片 2视频',
  url        VARCHAR(500)  NOT NULL                    COMMENT 'OSS CDN 完整地址',
  thumb_url  VARCHAR(500)  NOT NULL DEFAULT ''         COMMENT '缩略图（图片=url本身，视频=OSS截帧URL）',
  oss_key    VARCHAR(500)  NOT NULL DEFAULT ''         COMMENT 'OSS对象Key，用于后续删除',
  file_size  INT           DEFAULT 0                   COMMENT '文件字节数',
  duration   INT           DEFAULT NULL                COMMENT '视频时长（秒），图片为NULL',
  status     TINYINT       NOT NULL DEFAULT 1          COMMENT '1=正常 2=已删除',
  created_at DATETIME      DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user    (user_id),
  INDEX idx_type    (type),
  INDEX idx_status  (status),
  INDEX idx_created (created_at)
) ENGINE=InnoDB COMMENT='用户图库（照片/视频）';
