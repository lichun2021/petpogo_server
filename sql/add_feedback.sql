-- 用户反馈表
-- 执行方式：mysql -u root -p petpogo < sql/add_feedback.sql

USE petpogo;

CREATE TABLE IF NOT EXISTS t_feedback (
  id         BIGINT        PRIMARY KEY AUTO_INCREMENT,
  user_id    BIGINT        NOT NULL                    COMMENT '用户ID',
  nickname   VARCHAR(50)   NOT NULL DEFAULT ''         COMMENT '提交时的用户昵称（冗余存储，防止改名后失真）',
  type       TINYINT       NOT NULL DEFAULT 1          COMMENT '类型: 1建议 2投诉 3好评',
  title      VARCHAR(100)  NOT NULL DEFAULT ''         COMMENT '标题（用户自定义或默认类型名称）',
  content    VARCHAR(50)   NOT NULL                    COMMENT '反馈内容（最多50字）',
  status     TINYINT       NOT NULL DEFAULT 0          COMMENT '处理状态: 0未读 1已读 2已处理',
  created_at DATETIME      DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user    (user_id),
  INDEX idx_type    (type),
  INDEX idx_status  (status),
  INDEX idx_created (created_at)
) ENGINE=InnoDB COMMENT='用户反馈（建议/投诉/好评）';
