-- PetPogo 数据库初始化脚本
-- MySQL 8.0+，支持 JSON / SPATIAL / 分区
-- 包含：基础表 + VIP字段 + AI分析表 + 帖子标签

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
  tag            VARCHAR(20)  NOT NULL DEFAULT 'other' COMMENT '帖子标签 cat/dog/other',
  created_at     DATETIME     DEFAULT CURRENT_TIMESTAMP,
  deleted        TINYINT      DEFAULT 0,
  INDEX idx_user (user_id),
  INDEX idx_created (created_at),
  INDEX idx_status (status),
  INDEX idx_tag (tag)
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
-- AI 分析结果模块
-- ===========================

-- 音频情绪分析结果表
-- 对应 AI 接口：POST /voice/analyze
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

-- 图片情绪分析结果表
-- 对应 AI 接口：POST /dog-image/analyze
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

-- ===========================
-- 宠物音乐模块
-- ===========================
CREATE TABLE IF NOT EXISTS t_music_category (
  id         INT           PRIMARY KEY AUTO_INCREMENT,
  name       VARCHAR(50)   NOT NULL                  COMMENT '分类名称（助眠/安抚/平静…）',
  icon_url   VARCHAR(500)  NOT NULL DEFAULT ''       COMMENT '分类图标 OSS URL',
  sort_order INT           DEFAULT 0                 COMMENT '排序（越小越靠前）',
  created_at DATETIME      DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_name (name)
) ENGINE=InnoDB COMMENT='宠物音乐分类';

CREATE TABLE IF NOT EXISTS t_music (
  id          BIGINT        PRIMARY KEY AUTO_INCREMENT,
  category_id INT           NOT NULL                 COMMENT '分类ID',
  pet_type    VARCHAR(20)   NOT NULL DEFAULT 'all'   COMMENT '适用宠物类型(all/cat/dog)',
  name        VARCHAR(100)  NOT NULL                 COMMENT '音乐名称',
  icon_url    VARCHAR(500)  NOT NULL DEFAULT ''      COMMENT '封面图 OSS URL',
  music_url   VARCHAR(500)  NOT NULL                 COMMENT '音频 OSS URL',
  duration    INT           DEFAULT 0                COMMENT '时长(秒)',
  sort_order  INT           DEFAULT 0                COMMENT '排序',
  status      TINYINT       DEFAULT 1                COMMENT '1=正常 0=下架',
  created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cat (category_id),
  INDEX idx_status (status)
) ENGINE=InnoDB COMMENT='宠物音乐';

-- 默认分类
INSERT IGNORE INTO t_music_category (id, name, icon_url, sort_order) VALUES
  (1, '助眠', '', 1),
  (2, '安抚', '', 2),
  (3, '平静', '', 3),
  (4, '欢快', '', 4),
  (5, '自然', '', 5);

-- ===========================
-- 用户歌单模块
-- ===========================
CREATE TABLE IF NOT EXISTS t_music_playlist (
  id          BIGINT        PRIMARY KEY AUTO_INCREMENT,
  user_id     BIGINT        NOT NULL                 COMMENT '用户ID',
  name        VARCHAR(100)  NOT NULL                 COMMENT '歌单名称',
  cover_url   VARCHAR(500)  DEFAULT ''               COMMENT '封面图（可选，默认取第一首歌的封面）',
  sort_order  INT           DEFAULT 0,
  created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id)
) ENGINE=InnoDB COMMENT='用户自建歌单';

CREATE TABLE IF NOT EXISTS t_music_playlist_item (
  id          BIGINT        PRIMARY KEY AUTO_INCREMENT,
  playlist_id BIGINT        NOT NULL                 COMMENT '歌单ID',
  music_id    BIGINT        NOT NULL                 COMMENT '音乐ID',
  sort_order  INT           DEFAULT 0,
  created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_playlist_music (playlist_id, music_id),
  INDEX idx_playlist (playlist_id)
) ENGINE=InnoDB COMMENT='歌单歌曲明细';


-- ===========================
-- 系统设置模块
-- 执行方式：mysql -u root -p petpogo < sql/add_system_settings.sql
-- ===========================

USE petpogo;

CREATE TABLE IF NOT EXISTS t_system_settings (
  id          INT          PRIMARY KEY AUTO_INCREMENT,
  `key`       VARCHAR(100) NOT NULL UNIQUE          COMMENT '配置键（唯一）',
  `value`     VARCHAR(2000) NOT NULL DEFAULT ''     COMMENT '配置值',
  label       VARCHAR(100) NOT NULL DEFAULT ''      COMMENT '前端显示名称',
  description VARCHAR(300)          DEFAULT ''      COMMENT '配置说明',
  type        VARCHAR(20)  NOT NULL DEFAULT 'text'  COMMENT '值类型: text/boolean/number/json',
  group_name  VARCHAR(50)  NOT NULL DEFAULT 'general' COMMENT '分组: general/sms/oss/ai',
  sort_order  INT          DEFAULT 0                COMMENT '组内排序',
  created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_group (`group_name`),
  INDEX idx_key   (`key`)
) ENGINE=InnoDB COMMENT='系统全局配置表';

-- 默认配置项
INSERT IGNORE INTO t_system_settings (`key`, `value`, label, description, type, group_name, sort_order) VALUES
  -- 短信网关
  ('sms_enabled',           '1',                           '短信网关启用',       '控制短信验证码功能是否开启，关闭后所有短信将不发送',       'boolean', 'sms', 1),
  ('sms_provider',          'aliyun',                      '短信服务商',         '当前短信服务商: aliyun',                                 'text',    'sms', 2),
  ('sms_daily_limit',       '5',                           '单号每日发送上限',   '同一手机号每天最多可发送多少条验证码短信，0=不限',         'number',  'sms', 3),
  ('sms_code_expire_min',   '10',                          '验证码有效期(分钟)', '验证码有效期，超时后需重新发送',                           'number',  'sms', 4),
  -- 通用
  ('app_name',              '萌宠帮',                      '应用名称',           '在通知、短信签名等处展示的应用名称',                       'text',    'general', 1),
  ('register_open',         '1',                           '开放注册',           '关闭后新用户无法注册，仅已有账号可登录',                   'boolean', 'general', 2),
  ('ai_default_daily_limit','10',                          'AI默认每日上限',     '新注册用户默认的 AI 分析每日使用次数，-1=无限',           'number',  'general', 3),
  -- OSS
  ('oss_cdn_base_url',      'https://pet-20260430.oss-cn-shanghai.aliyuncs.com', 'OSS CDN 地址', '静态资源 CDN 基础地址，结尾不加 /', 'text', 'oss', 1);

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


CREATE TABLE IF NOT EXISTS t_media (
  id         BIGINT        PRIMARY KEY AUTO_INCREMENT,
  user_id    BIGINT        NOT NULL                    COMMENT '上传用户ID',
  device_id  VARCHAR(50)   NOT NULL DEFAULT ''         COMMENT '关联设备ID（t_device.id）',
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

-- 打招呼事件表（2026-06-11）
-- 用户主动打招呼：App发送招呼音 → 设备播放 → 录制宠物响应 → AI情绪分析
CREATE TABLE IF NOT EXISTS t_greeting_event (
  id            BIGINT        PRIMARY KEY AUTO_INCREMENT,
  user_id       BIGINT        NOT NULL    COMMENT '用户ID（发起打招呼的用户）',
  device_id     VARCHAR(50)   NOT NULL    COMMENT '设备MAC地址',
  resource_url     TEXT          COMMENT '招呼音频URL（用户发给设备的音频）',
  response_url  TEXT          COMMENT '宠物响应资源URL（设备录制的视频/音频）',
  cover_url     VARCHAR(500)  COMMENT '响应视频封面URL',
  ai_result     JSON          COMMENT 'AI情绪分析结果（JSON）',
  status        TINYINT       DEFAULT 1   COMMENT '1正常 0已删除',
  created_at    DATETIME      DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id   (user_id),
  INDEX idx_device_id (device_id),
  INDEX idx_created_at(created_at)
) ENGINE=InnoDB COMMENT='用户打招呼事件表';


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



-- ===========================
-- 预设情绪声音表（后台管理）
-- ===========================
-- 每种情绪可配置多条默认声音，后台可自由增删改
CREATE TABLE IF NOT EXISTS t_sound_preset (
  id          BIGINT        PRIMARY KEY AUTO_INCREMENT,
  pet_type VARCHAR(10) NOT NULL DEFAULT 'cat' COMMENT '宠物类型: cat/dog' 
  emotion     VARCHAR(50)   NOT NULL    COMMENT '情绪类型: happy/sad/excited/calm/angry/scared/neutral',
  name        VARCHAR(100)  NOT NULL    COMMENT '声音名称',
  url         TEXT          NOT NULL    COMMENT '声音OSS直链',
  sort_order  INT           DEFAULT 0   COMMENT '排序（越小越靠前）',
  status      TINYINT       DEFAULT 1   COMMENT '1启用 0禁用',
  created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME      ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_emotion    (emotion),
  INDEX idx_status     (status),
  INDEX idx_sort_order (sort_order)
) ENGINE=InnoDB COMMENT='预设情绪声音表（后台管理）';

-- ===========================
-- 用户自定义声音表
-- ===========================
-- 用户自己上传的声音，可选关联情绪
CREATE TABLE IF NOT EXISTS t_sound_user (
  id          BIGINT        PRIMARY KEY AUTO_INCREMENT,
  user_id     BIGINT        NOT NULL    COMMENT '用户ID',
  pet_type    VARCHAR(10)   NOT NULL    DEFAULT 'cat' COMMENT '宠物类型: cat/dog',
  emotion     VARCHAR(50)   COMMENT '对应情绪类型（可不填）',
  name        VARCHAR(100)  NOT NULL    COMMENT '声音名称',
  url         TEXT          NOT NULL    COMMENT '声音OSS直链',
  duration    INT           COMMENT '时长（秒）',
  status      TINYINT       DEFAULT 1   COMMENT '1正常 0已删除',
  created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id  (user_id),
  INDEX idx_pet_type (pet_type),
  INDEX idx_emotion  (emotion),
  INDEX idx_status   (status)
) ENGINE=InnoDB COMMENT='用户自定义声音表';

-- 为预设声音表增加宠物类型字段（历史迁移）
ALTER TABLE t_sound_preset ADD COLUMN IF NOT EXISTS pet_type VARCHAR(10) NOT NULL DEFAULT 'cat' COMMENT '宠物类型: cat/dog' AFTER emotion;
ALTER TABLE t_sound_preset ADD INDEX IF NOT EXISTS idx_pet_type (pet_type);

-- 同一物种下情绪标签唯一（一个物种只能有一个 happy）
ALTER TABLE t_sound_preset ADD UNIQUE INDEX IF NOT EXISTS uk_pet_emotion (pet_type, emotion);
