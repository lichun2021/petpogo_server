-- PetPogo 数据库初始化脚本
-- MySQL 8.0+，支持 JSON / SPATIAL / 分区

CREATE DATABASE IF NOT EXISTS petpogo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE petpogo;

-- ===========================
-- 用户模块
-- ===========================
CREATE TABLE IF NOT EXISTS t_user (
  id              BIGINT       PRIMARY KEY COMMENT 'SnowflakeID',
  phone           VARCHAR(20)  UNIQUE NOT NULL,
  password        VARCHAR(100) COMMENT 'Login password, hashed',
  nickname        VARCHAR(50),
  avatar          VARCHAR(500),
  gender          TINYINT      DEFAULT 0   COMMENT '0未知 1男 2女',
  birthday        DATE,
  bio             VARCHAR(200),
  status          TINYINT      DEFAULT 1   COMMENT '1正常 2禁用',
  vip_status      TINYINT      DEFAULT 0   COMMENT '0普通 1VIP',
  vip_expire_at   DATETIME     NULL        COMMENT 'VIP到期时间，NULL=永久',
  ai_daily_limit  INT          DEFAULT 10  COMMENT '每日AI调用上限，-1=无限制',
  identity_id     VARCHAR(100) COMMENT '旧系统 AWS IoT identityId',
  created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     ON UPDATE CURRENT_TIMESTAMP,
  deleted         TINYINT      DEFAULT 0,
  INDEX idx_phone (phone),
  INDEX idx_status (status),
  INDEX idx_vip (vip_status)
) ENGINE=InnoDB;

-- ===========================
-- AI 使用量记录表（按天）
-- ===========================
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


-- ===========================
-- 设备模块
-- ===========================
CREATE TABLE IF NOT EXISTS t_device (
  id             BIGINT       PRIMARY KEY,
  mac            VARCHAR(50)  UNIQUE NOT NULL,
  product_id     BIGINT,
  name           VARCHAR(100),
  wifi_version   VARCHAR(50),
  mcu_version    VARCHAR(50),
  online_status  BOOLEAN      DEFAULT FALSE,
  last_online_at DATETIME,
  longitude      VARCHAR(30),
  latitude       VARCHAR(30),
  address        VARCHAR(500),
  merchant_id    BIGINT       COMMENT '旧系统 merchantId，用于 Redis Key 拼接',
  param          JSON,
  status         TINYINT      DEFAULT 1,
  created_at     DATETIME     DEFAULT CURRENT_TIMESTAMP,
  deleted        TINYINT      DEFAULT 0,
  INDEX idx_mac (mac),
  INDEX idx_merchant (merchant_id),
  INDEX idx_online (online_status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS t_user_device (
  id           BIGINT       PRIMARY KEY,
  user_id      BIGINT       NOT NULL,
  device_id    BIGINT       NOT NULL,
  mac          VARCHAR(50)  NOT NULL,
  nickname     VARCHAR(100),
  u_type       VARCHAR(20)  DEFAULT 'owner' COMMENT 'owner/shared',
  sharer_id    BIGINT,
  created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_device (user_id, device_id),
  INDEX idx_device (device_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS t_pet (
  id         BIGINT        PRIMARY KEY,
  user_id    BIGINT        NOT NULL,
  device_id  BIGINT,
  name       VARCHAR(50)   NOT NULL,
  avatar     VARCHAR(500),
  species    VARCHAR(50)   COMMENT 'cat/dog',
  breed      VARCHAR(100),
  gender     TINYINT       DEFAULT 0,
  birthday   DATE,
  weight     DECIMAL(5,2),
  bio        VARCHAR(300),
  deleted    TINYINT       DEFAULT 0,
  created_at DATETIME      DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_device (device_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS t_pet_fence (
  id               BIGINT       PRIMARY KEY,
  device_id        BIGINT       NOT NULL,
  user_id          BIGINT       NOT NULL,
  fence_name       VARCHAR(100),
  radius           INT          COMMENT '米',
  longitude        VARCHAR(30),
  latitude         VARCHAR(30),
  wsg84_longitude  VARCHAR(30),
  wsg84_latitude   VARCHAR(30),
  gcj02_longitude  VARCHAR(30),
  gcj02_latitude   VARCHAR(30),
  bd09_longitude   VARCHAR(30),
  bd09_latitude    VARCHAR(30),
  address          VARCHAR(500),
  deleted          TINYINT      DEFAULT 0,
  created_at       DATETIME     DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_device (device_id),
  INDEX idx_user (user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS t_fence_alert (
  id         BIGINT    PRIMARY KEY,
  fence_id   BIGINT    NOT NULL,
  device_id  BIGINT    NOT NULL,
  user_id    BIGINT    NOT NULL,
  distance   INT       COMMENT '越界距离（米）',
  created_at DATETIME  DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_fence (fence_id),
  INDEX idx_user_time (user_id, created_at)
) ENGINE=InnoDB;

-- ===========================
-- 社交模块
-- ===========================
CREATE TABLE IF NOT EXISTS t_post (
  id             BIGINT       PRIMARY KEY,
  user_id        BIGINT       NOT NULL,
  pet_id         BIGINT,
  content        TEXT,
  media_type     TINYINT      DEFAULT 0  COMMENT '0纯文字 1图片 2视频',
  media_urls     JSON         COMMENT '最多9张图片URL',
  video_url      VARCHAR(500),
  cover_url      VARCHAR(500),
  raw_video_key  VARCHAR(500) COMMENT 'OSS原始视频Key（MPS处理用）',
  duration       INT          COMMENT '视频时长秒',
  location       VARCHAR(200),
  longitude      VARCHAR(30),
  latitude       VARCHAR(30),
  like_count     INT          DEFAULT 0,
  comment_count  INT          DEFAULT 0,
  share_count    INT          DEFAULT 0,
  view_count     INT          DEFAULT 0,
  status         TINYINT      DEFAULT 1  COMMENT '1正常 2处理中 3违规',
  visibility     TINYINT      DEFAULT 1  COMMENT '1公开 2仅自己',
  created_at     DATETIME     DEFAULT CURRENT_TIMESTAMP,
  deleted        TINYINT      DEFAULT 0,
  INDEX idx_user (user_id),
  INDEX idx_created (created_at),
  INDEX idx_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS t_post_comment (
  id          BIGINT       PRIMARY KEY,
  post_id     BIGINT       NOT NULL,
  user_id     BIGINT       NOT NULL,
  parent_id   BIGINT       DEFAULT 0,
  reply_to_id BIGINT,
  content     VARCHAR(500),
  like_count  INT          DEFAULT 0,
  created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
  deleted     TINYINT      DEFAULT 0,
  INDEX idx_post (post_id, parent_id),
  INDEX idx_user (user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS t_like (
  id          BIGINT    PRIMARY KEY,
  user_id     BIGINT    NOT NULL,
  target_id   BIGINT    NOT NULL,
  target_type TINYINT   COMMENT '1帖子 2评论',
  created_at  DATETIME  DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_like (user_id, target_id, target_type)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS t_follow (
  id           BIGINT    PRIMARY KEY,
  follower_id  BIGINT    NOT NULL,
  following_id BIGINT    NOT NULL,
  created_at   DATETIME  DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_follow (follower_id, following_id),
  INDEX idx_following (following_id)
) ENGINE=InnoDB;

-- ===========================
-- 门店 / 商品模块
-- ===========================
CREATE TABLE IF NOT EXISTS t_store (
  id             BIGINT         PRIMARY KEY,
  name           VARCHAR(200)   NOT NULL,
  category       VARCHAR(50)    COMMENT '宠物医院/宠物店/美容/寄养',
  cover          VARCHAR(500),
  images         JSON,
  phone          VARCHAR(20),
  address        VARCHAR(500),
  longitude      DECIMAL(10,7)  NOT NULL,
  latitude       DECIMAL(10,7)  NOT NULL,
  location       POINT          NOT NULL SRID 0,
  city           VARCHAR(50),
  province       VARCHAR(50),
  rating         DECIMAL(3,1)   DEFAULT 5.0,
  review_count   INT            DEFAULT 0,
  is_hot         BOOLEAN        DEFAULT FALSE,
  business_hours VARCHAR(200),
  status         TINYINT        DEFAULT 1,
  created_at     DATETIME       DEFAULT CURRENT_TIMESTAMP,
  SPATIAL INDEX idx_location (location),
  INDEX idx_city (city),
  INDEX idx_hot (is_hot)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS t_product (
  id             BIGINT         PRIMARY KEY,
  store_id       BIGINT,
  name           VARCHAR(200)   NOT NULL,
  category       VARCHAR(50),
  cover          VARCHAR(500),
  images         JSON,
  price          DECIMAL(10,2),
  original_price DECIMAL(10,2),
  description    TEXT,
  sales_count    INT            DEFAULT 0,
  stock          INT            DEFAULT 0,
  is_hot         BOOLEAN        DEFAULT FALSE,
  status         TINYINT        DEFAULT 1,
  created_at     DATETIME       DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_store (store_id),
  INDEX idx_hot (is_hot),
  INDEX idx_sales (sales_count)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS t_store_review (
  id         BIGINT    PRIMARY KEY,
  store_id   BIGINT    NOT NULL,
  user_id    BIGINT    NOT NULL,
  rating     TINYINT   NOT NULL,
  content    VARCHAR(500),
  images     JSON,
  created_at DATETIME  DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_store (store_id),
  INDEX idx_user (user_id)
) ENGINE=InnoDB;

-- 插入测试门店数据
INSERT IGNORE INTO t_store (id, name, category, cover, address, longitude, latitude, location, city, province, rating, is_hot, business_hours, status)
VALUES
  (1, '爱宠动物医院', '宠物医院', '', '北京市朝阳区建国路88号', 116.4634, 39.9093, ST_GeomFromText('POINT(116.4634 39.9093)', 0), '北京', '北京', 4.8, TRUE, '09:00-21:00', 1),
  (2, '萌宠美容中心', '美容', '', '北京市海淀区中关村大街45号', 116.3176, 39.9825, ST_GeomFromText('POINT(116.3176 39.9825)', 0), '北京', '北京', 4.6, TRUE, '10:00-20:00', 1);
