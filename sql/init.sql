-- PetPogo 数据库初始化脚本
-- MySQL 8.0+，支持 JSON / SPATIAL / 分区
-- 包含：基础表 + 购买计划/积分/签到 + AI分析表 + 帖子标签

CREATE DATABASE IF NOT EXISTS petpogo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE petpogo;

-- ===========================
-- 用户模块
-- ===========================
CREATE TABLE IF NOT EXISTS t_user (
  id                 BIGINT       PRIMARY KEY COMMENT 'SnowflakeID',
  phone              VARCHAR(20)  UNIQUE NOT NULL,
  password           VARCHAR(100) COMMENT 'Login password, hashed',
  nickname           VARCHAR(50),
  avatar             VARCHAR(500),
  gender             TINYINT      DEFAULT 0   COMMENT '0未知 1男 2女',
  birthday           DATE,
  bio                VARCHAR(200),
  status             TINYINT      DEFAULT 1   COMMENT '1正常 2禁用',
  plan_type             TINYINT      DEFAULT 0   COMMENT '0=Free 1=Pro 2=ProMax',
  plan_expire_at        DATETIME     NULL        COMMENT '当前计划到期时间，NULL=永久(Free)',
  last_grant_at         DATETIME     NULL        COMMENT '上次周期积分发放时刻，用于定时发放判断(每周期发一次，用户离线也累计)',
  identity_id        VARCHAR(100) COMMENT '旧系统 AWS IoT identityId',
  created_at         DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME     ON UPDATE CURRENT_TIMESTAMP,
  deleted            TINYINT      DEFAULT 0,
  INDEX idx_phone (phone),
  INDEX idx_status (status),
  INDEX idx_plan (plan_type)
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
) ENGINE=InnoDB COMMENT='已废弃：改用 t_device_event 统一表（保留存量数据，不再写入）';

-- ===========================
-- 设备事件模块（越界/离线/低电统一表）
-- ===========================
CREATE TABLE IF NOT EXISTS t_device_event (
  id            BIGINT       PRIMARY KEY COMMENT 'Snowflake ID',
  user_id       BIGINT       NOT NULL COMMENT '事件归属用户',
  event_type    VARCHAR(20)  NOT NULL COMMENT '事件类型：breach越界 / offline离线 / low_battery低电',
  device_mac    VARCHAR(50)  NOT NULL COMMENT '设备MAC（App 展示 + 推送 extras 用）',
  device_name   VARCHAR(100) COMMENT '设备名快照（防改名失真）',
  pet_id        BIGINT       COMMENT '关联宠物（breach 事件可能带）',
  pet_name      VARCHAR(50)  COMMENT '宠物名快照',
  description   VARCHAR(500) COMMENT '事件描述文案',
  extra         JSON         COMMENT '类型特有字段（如 distance / battery_percent / product_key）',
  is_read       TINYINT      DEFAULT 0 COMMENT '0=未读 1=已读',
  created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_time (user_id, created_at),
  INDEX idx_user_read (user_id, is_read),
  INDEX idx_type (event_type)
) ENGINE=InnoDB COMMENT='设备事件统一表（越界/离线/低电，PeerApi 回调落库）';

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

CREATE TABLE IF NOT EXISTS t_pet_circle_post (
  id             BIGINT       PRIMARY KEY AUTO_INCREMENT,
  owner_user_id  BIGINT       NOT NULL COMMENT '宠物主人用户ID',
  pet_id         VARCHAR(80)  NOT NULL COMMENT '宠物ID，可来自 PeerApi',
  pet_name       VARCHAR(80)  NOT NULL DEFAULT '',
  pet_avatar     VARCHAR(500) NOT NULL DEFAULT '',
  content        TEXT         NOT NULL,
  media_type     TINYINT      NOT NULL DEFAULT 0 COMMENT '0文字 1图片 2视频',
  media_urls     JSON         NULL COMMENT '图片或视频地址列表',
  cover_url      VARCHAR(500) NOT NULL DEFAULT '',
  event_type     VARCHAR(40)  NOT NULL DEFAULT 'ai_daily',
  source_id      VARCHAR(120) NULL COMMENT 'AI/设备侧幂等来源ID',
  source_time    DATETIME     NULL,
  status         TINYINT      NOT NULL DEFAULT 1 COMMENT '1正常 0删除',
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_source (owner_user_id, pet_id, event_type, source_id),
  INDEX idx_owner_pet_time (owner_user_id, pet_id, status, created_at),
  INDEX idx_pet_time (pet_id, status, created_at),
  INDEX idx_source_time (source_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='萌宠圈自动动态';

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
  type        VARCHAR(20)  NOT NULL DEFAULT 'text'  COMMENT '值类型: text/boolean/number/json/secret',
  group_name  VARCHAR(50)  NOT NULL DEFAULT 'general' COMMENT '分组: general/sms/oss/ai/client',
  status      TINYINT      NOT NULL DEFAULT 1      COMMENT '1=启用 0=停用（client分组停用后App不返回该项）',
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
  -- OSS
  ('oss_cdn_base_url',      'https://pet-20260430.oss-cn-shanghai.aliyuncs.com', 'OSS CDN 地址', '静态资源 CDN 基础地址，结尾不加 /', 'text', 'oss', 1),
  -- 客户端运行时配置（App 启动时通过 /sdkapi/config/client 拉取，secret 类型对App脱敏）
  ('client_app_force_update', '0',  '强制更新开关', '开启后 App 应弹窗强制更新', 'boolean', 'client', 1),
  ('client_min_version',      '1.0.0', '最低可用版本', '低于此版本 App 应提示更新', 'text', 'client', 2),
  ('client_update_url_ios',   '',     'iOS 下载地址', 'App Store 或 TestFlight 链接', 'text', 'client', 3),
  ('client_update_url_android','',     'Android 下载地址', 'APK 下载直链或应用市场链接', 'text', 'client', 4),
  ('client_service_hotline',  '',     '客服热线', 'App「联系我们」展示的电话', 'text', 'client', 5),
  ('client_map_api_key',      '',     '地图 SDK Key', '客户端地图 SDK 使用的密钥（对App脱敏返回）', 'secret', 'client', 6);

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
-- 业务分享链接（App 分享到微信/H5）
-- ===========================
CREATE TABLE IF NOT EXISTS t_share_link (
  id            BIGINT       PRIMARY KEY AUTO_INCREMENT,
  code          VARCHAR(32)  NOT NULL COMMENT '分享短码',
  user_id       BIGINT       NOT NULL COMMENT '创建分享的用户ID',
  share_type    VARCHAR(32)  NOT NULL COMMENT 'pet/device/location/capture/greeting',
  target_id     VARCHAR(80)  NOT NULL COMMENT '业务对象ID或设备MAC',
  title         VARCHAR(120) NOT NULL DEFAULT '',
  description   VARCHAR(300) NOT NULL DEFAULT '',
  image_url     VARCHAR(500) NOT NULL DEFAULT '',
  payload       JSON         NULL COMMENT '只放公开展示所需摘要，不放敏感权限',
  expire_at     DATETIME     NOT NULL,
  status        TINYINT      NOT NULL DEFAULT 1 COMMENT '1正常 0失效',
  created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_code (code),
  INDEX idx_user (user_id),
  INDEX idx_type_target (share_type, target_id),
  INDEX idx_expire (expire_at)
) ENGINE=InnoDB COMMENT='App业务分享链接';


-- ===========================
-- 预设情绪声音表（后台管理）
-- ===========================
-- 每种情绪可配置多条默认声音，后台可自由增删改
CREATE TABLE IF NOT EXISTS t_sound_preset (
  id          BIGINT        PRIMARY KEY AUTO_INCREMENT,
  pet_type    VARCHAR(10)   NOT NULL DEFAULT 'cat' COMMENT '宠物类型: cat/dog',
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

-- ===========================
-- 管理后台账号模块
-- ===========================
CREATE TABLE IF NOT EXISTS t_admin (
  id              BIGINT       PRIMARY KEY COMMENT 'SnowflakeID',
  username        VARCHAR(50)  UNIQUE NOT NULL,
  password        VARCHAR(255) NOT NULL COMMENT 'scrypt格式: salt:hash',
  nickname        VARCHAR(50),
  role            VARCHAR(20)  DEFAULT 'admin' COMMENT 'super_admin=超级管理员 admin=普通管理员',
  status          TINYINT      DEFAULT 1   COMMENT '1正常 2禁用',
  last_login_at   DATETIME     NULL,
  created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     ON UPDATE CURRENT_TIMESTAMP,
  deleted         TINYINT      DEFAULT 0,
  INDEX idx_username (username),
  INDEX idx_status (status)
) ENGINE=InnoDB COMMENT='后台管理员账号表';

-- ===========================
-- 迁移脚本（在已有数据库上执行，将旧的 vip_status/vip_expire_at/ai_daily_limit
-- 迁移为 plan_type/plan_expire_at + 积分字段）：
--
-- ALTER TABLE t_user
--   DROP INDEX idx_vip,
--   ADD COLUMN plan_type TINYINT DEFAULT 0 COMMENT '0=Free 1=Pro 2=ProMax' AFTER status,
--   CHANGE COLUMN vip_expire_at plan_expire_at DATETIME NULL COMMENT '当前计划到期时间，NULL=永久(Free)' AFTER plan_type,
--   DROP COLUMN vip_status,
--   DROP COLUMN ai_daily_limit,
--   ADD COLUMN points_weekly INT DEFAULT 0 COMMENT '周积分(到期积分)，每周一按当前计划配额重置' AFTER plan_expire_at,
--   ADD COLUMN points_permanent INT DEFAULT 0 COMMENT '永久积分，不过期' AFTER points_weekly,
--   ADD COLUMN points_week_start DATE NULL COMMENT '当前周积分对应的周一日期，用于惰性重置判断' AFTER points_permanent,
--   ADD INDEX idx_plan (plan_type);
--
-- DROP TABLE IF EXISTS t_ai_usage;
--
-- -- 补签功能上线时，给已有 t_plan 表追加 weekly_makeup_quota 列：
-- ALTER TABLE t_plan ADD COLUMN weekly_makeup_quota INT DEFAULT 1 COMMENT '会员权益：每周可补签次数' AFTER permanent_points_grant;
-- UPDATE t_plan SET weekly_makeup_quota=1 WHERE plan_type=0;
-- UPDATE t_plan SET weekly_makeup_quota=3 WHERE plan_type=1;
-- UPDATE t_plan SET weekly_makeup_quota=5 WHERE plan_type=2;
--
-- -- 若已有 monthly_makeup_quota 列，改用以下重命名语句代替上面的 ADD COLUMN：
-- ALTER TABLE t_plan RENAME COLUMN monthly_makeup_quota TO weekly_makeup_quota;
-- ALTER TABLE t_plan MODIFY COLUMN weekly_makeup_quota INT DEFAULT 1 COMMENT '会员权益：每周可补签次数';
--
-- -- 补签功能上线时，给已有 t_checkin_log 表追加 is_makeup 列：
-- ALTER TABLE t_checkin_log ADD COLUMN is_makeup TINYINT DEFAULT 0 COMMENT '0=当日正常签到 1=补签' AFTER streak_count;

-- ===========================
-- 购买计划模块（Free / Pro / ProMax）
-- ===========================
CREATE TABLE IF NOT EXISTS t_plan (
  id                     BIGINT PRIMARY KEY AUTO_INCREMENT,
  plan_type              TINYINT       NOT NULL UNIQUE COMMENT '0=Free 1=Pro 2=ProMax',
  name                   VARCHAR(30)   NOT NULL,
  price                  DECIMAL(10,2) DEFAULT 0,
  duration_days          INT           NULL COMMENT '订阅周期天数，NULL=永久(仅Free)',
  price_monthly          DECIMAL(10,2) DEFAULT 0  COMMENT '月费价格（付费计划，0=无月费档）',
  price_yearly           DECIMAL(10,2) DEFAULT 0  COMMENT '年费价格（付费计划，0=无年费档）',
  grant_period_days      INT           DEFAULT 7 COMMENT '周期积分发放周期（天数）：每 N 天发一次，Free=7(每周) Pro=30(每月)等',
  period_grant_amount    INT           DEFAULT 0 COMMENT '每周期赠送的积分数量（定时累加发放，非覆盖）',
  period_grant_type_code VARCHAR(32)   DEFAULT NULL COMMENT '每周期赠送积分所属类型(有效期由 t_points_config 决定)，NULL=跟随计划默认类型',
  weekly_makeup_quota    INT           DEFAULT 1 COMMENT '会员权益：每周可补签次数',
  description            VARCHAR(500),
  status                 TINYINT       DEFAULT 1,
  sort_order             INT           DEFAULT 0,
  created_at             DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME      ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB COMMENT='购买计划配置表';

INSERT IGNORE INTO t_plan (plan_type, name, price_monthly, price_yearly, duration_days, grant_period_days, period_grant_amount, period_grant_type_code, weekly_makeup_quota, description, sort_order) VALUES
(0, 'Free',    0.00,  0.00,   NULL, 7,  70,   'plan_free',  1, '免费计划，每周赠送基础积分', 1),
(1, 'Pro',     30.00, 299.00, 30,   30, 700,  'plan_pro',   3, 'Pro 计划，每月赠送大量积分', 2),
(2, 'ProMax',  98.00, 888.00, 30,   30, 2000, 'plan_promax',5, 'ProMax 计划，积分额度更高', 3);

CREATE TABLE IF NOT EXISTS t_plan_order (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id     BIGINT NOT NULL,
  plan_id     BIGINT NOT NULL,
  period      VARCHAR(10) DEFAULT 'monthly' COMMENT '购买档位 monthly=月费 yearly=年费',
  amount      DECIMAL(10,2),
  status      TINYINT  DEFAULT 0 COMMENT '0待支付 1已支付(人工确认) 2已取消',
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  paid_at     DATETIME NULL,
  INDEX idx_user (user_id),
  INDEX idx_status (status)
) ENGINE=InnoDB COMMENT='计划购买订单表（占位，不接第三方支付）';

-- ===========================
-- 积分类型配置表（只定义类型与有效期，数量在各业务表配）
-- ===========================
-- type_code: 程序内引用标识
-- expire_days: 有效期天数，0=永不过期（只有付费计划赠送的永久积分不过期）
CREATE TABLE IF NOT EXISTS t_points_config (
  id          INT          PRIMARY KEY AUTO_INCREMENT,
  type_code   VARCHAR(32)  NOT NULL UNIQUE COMMENT '类型标识（程序内引用）',
  name        VARCHAR(64)  NOT NULL COMMENT '后台显示名',
  expire_days INT          NOT NULL DEFAULT 0 COMMENT '有效期天数，0=永不过期',
  sort_order  INT          NOT NULL DEFAULT 0,
  status      TINYINT      NOT NULL DEFAULT 1,
  updated_at  DATETIME     ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB COMMENT='积分类型配置表（只定义类型与有效期，数量在各业务表配）';

INSERT IGNORE INTO t_points_config (type_code, name, expire_days, sort_order) VALUES
  ('permanent',  '永久积分',        0,  0),
  ('plan_free',  'Free计划积分',   7,  1),
  ('plan_pro',   'Pro计划积分',    30, 2),
  ('plan_promax','ProMax计划积分', 30, 3),
  ('checkin',    '签到积分',       7,  4);

-- ===========================
-- 用户积分批次表（核心：每笔赠送一条，独立到期）
-- ===========================
-- 消费时按 expire_at 升序扣减（先到期先扣），expire_at IS NULL 的永久批次最后扣。
-- 到期批次在读取余额时惰性失效（remaining 置 0），无需 cron。
CREATE TABLE IF NOT EXISTS t_user_points_batch (
  id            BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id       BIGINT NOT NULL,
  type_code     VARCHAR(32) NOT NULL COMMENT '引用 t_points_config.type_code',
  granted_amount INT NOT NULL COMMENT '发放时的数量',
  remaining     INT NOT NULL COMMENT '剩余可用数量',
  expire_at     DATETIME NULL COMMENT '到期时间，NULL=永不过期',
  reason        VARCHAR(100),
  ref_type      VARCHAR(30) COMMENT 'checkin/plan_order/admin_adjust',
  ref_id        VARCHAR(50),
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_expire (user_id, expire_at),
  INDEX idx_user_type (user_id, type_code)
) ENGINE=InnoDB COMMENT='用户积分批次表（每笔赠送一条，独立到期）';

-- 迁移注释（生产环境已有旧表时手动执行）：
-- DROP TABLE IF EXISTS t_points_grant_config;  -- 已被 t_points_config 替代
-- ALTER TABLE t_user DROP COLUMN points_weekly, DROP COLUMN points_week_start;
-- （points_permanent 列可保留做历史备份，新逻辑全部走 t_user_points_batch 求和）


-- ===========================
-- 积分模块
-- ===========================
CREATE TABLE IF NOT EXISTS t_points_log (
  id            BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id       BIGINT NOT NULL,
  direction     TINYINT COMMENT '1获得 2消耗',
  points_type   TINYINT COMMENT '废弃：旧 1周积分 2永久积分，向后兼容保留',
  type_code     VARCHAR(32) COMMENT '积分类型(引用 t_points_config.type_code)',
  amount        INT     COMMENT '变动数量(正数)',
  balance_after INT     COMMENT '变动后该类型余额',
  expire_at     DATETIME NULL COMMENT '本批次到期时间(获得记录)',
  reason        VARCHAR(100) COMMENT '如：AI图片分析消耗/每日签到奖励/连续签到奖励/购买Pro赠送',
  ref_type      VARCHAR(30)  COMMENT 'ai_consumption/checkin/plan_order',
  ref_id        VARCHAR(50),
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id, created_at)
) ENGINE=InnoDB COMMENT='积分流水表';

CREATE TABLE IF NOT EXISTS t_points_consume_rule (
  id            BIGINT PRIMARY KEY AUTO_INCREMENT,
  consume_type  VARCHAR(50) NOT NULL UNIQUE COMMENT '消费类型标识，如 image_analyze/voice_analyze',
  name          VARCHAR(50) COMMENT '后台展示名，如"图片情绪分析"',
  unit_points   INT NOT NULL COMMENT '每单位消耗的积分数',
  unit_basis    VARCHAR(20) DEFAULT 'per_call' COMMENT 'per_call=按次 per_unit=按上报数量(如每1k token)',
  status        TINYINT DEFAULT 1,
  sort_order    INT DEFAULT 0,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB COMMENT='积分消费规则表（AI消费类型 -> 积分单价）';

INSERT IGNORE INTO t_points_consume_rule (consume_type, name, unit_points, unit_basis, sort_order) VALUES
('image_analyze', '图片情绪',   5,  'per_call', 1),
('voice_analyze', '语音情绪',   5,  'per_call', 2),
('consult_q',     '问诊提问', 10, 'per_call', 3);

-- ===========================
-- 签到模块
-- ===========================
CREATE TABLE IF NOT EXISTS t_checkin_log (
  id            BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id       BIGINT NOT NULL,
  checkin_date  DATE NOT NULL,
  streak_count  INT DEFAULT 1 COMMENT '截至当日的连续签到天数',
  is_makeup     TINYINT DEFAULT 0 COMMENT '0=当日正常签到 1=补签',
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_date (user_id, checkin_date)
) ENGINE=InnoDB COMMENT='签到记录表';

CREATE TABLE IF NOT EXISTS t_checkin_rule (
  id            BIGINT PRIMARY KEY AUTO_INCREMENT,
  rule_type     TINYINT COMMENT '1每日签到奖励 2连续签到奖励',
  streak_days   INT DEFAULT 1 COMMENT '连续天数门槛；每日签到奖励固定为1',
  points_amount INT NOT NULL,
  points_type_code VARCHAR(32) NOT NULL DEFAULT 'checkin' COMMENT '签到积分所属类型(引用 t_points_config.type_code)',
  name          VARCHAR(50) COMMENT '如"每日签到""连续3天""连续7天"',
  status        TINYINT DEFAULT 1,
  sort_order    INT DEFAULT 0,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB COMMENT='签到奖励档位表';

INSERT IGNORE INTO t_checkin_rule (rule_type, streak_days, points_amount, points_type_code, name, sort_order) VALUES
(1, 1, 2,  'checkin', '每日签到', 1),
(2, 3, 10, 'checkin', '连续3天',  2),
(2, 7, 30, 'checkin', '连续7天',  3),
(2, 15, 80, 'checkin', '连续15天', 4),
(2, 30, 200,'checkin', '连续30天', 5);

CREATE TABLE IF NOT EXISTS t_checkin_claim_log (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id     BIGINT NOT NULL,
  rule_id     BIGINT NOT NULL,
  period_key  VARCHAR(20) COMMENT '每日奖励=日期；连续奖励=本次连续签到的起始日期',
  claimed_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_rule_period (user_id, rule_id, period_key)
) ENGINE=InnoDB COMMENT='签到奖励领取记录表';
) ENGINE=InnoDB COMMENT='签到奖励领取记录表';

-- ===========================
-- 电子宠物模块（养成属性 / 资源库 / 互动 / 硬件动作 / 统一事件日志）
-- ===========================

-- t_pet 增加养成属性与形象/背景引用字段
ALTER TABLE t_pet ADD COLUMN IF NOT EXISTS satiety INT NOT NULL DEFAULT 100 COMMENT '饱腹度 0-100';
ALTER TABLE t_pet ADD COLUMN IF NOT EXISTS mood INT NOT NULL DEFAULT 100 COMMENT '心情值 0-100';
ALTER TABLE t_pet ADD COLUMN IF NOT EXISTS cleanliness INT NOT NULL DEFAULT 100 COMMENT '清洁度 0-100';
ALTER TABLE t_pet ADD COLUMN IF NOT EXISTS background_id BIGINT NULL COMMENT '当前背景，引用 t_pet_background.id';
ALTER TABLE t_pet ADD COLUMN IF NOT EXISTS model_id BIGINT NULL COMMENT '当前形象，引用 t_pet_model.id';
ALTER TABLE t_pet ADD COLUMN IF NOT EXISTS stats_updated_at DATETIME NULL COMMENT '养成属性最后一次写入/衰减基准时间';
ALTER TABLE t_pet ADD COLUMN IF NOT EXISTS updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间';

-- GLB 动作标识库：动作是内嵌在各宠物形象 GLB 模型里的动画片段（clip），所有形象通用同一套命名，
-- 因此本表只登记"动作标识码"，不上传任何文件；互动类型 / 硬件动作码引用它决定用哪个片段名播放动画
CREATE TABLE IF NOT EXISTS t_pet_glb_action (
  id          BIGINT        PRIMARY KEY COMMENT 'Snowflake ID',
  code        VARCHAR(50)   NOT NULL COMMENT '动作标识码，对应宠物模型GLB内置动画片段(clip)的名称，App按此名去当前加载的模型里查找并播放',
  name        VARCHAR(100)  NOT NULL COMMENT '动作显示名称（后台展示用）',
  enabled     TINYINT       NOT NULL DEFAULT 1 COMMENT '1启用 0停用',
  deleted     TINYINT       NOT NULL DEFAULT 0,
  created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME      ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_code (code),
  INDEX idx_enabled (enabled)
) ENGINE=InnoDB COMMENT='GLB 动作标识库（对应模型内置动画片段名，所有宠物形象通用，不含文件）';

INSERT IGNORE INTO t_pet_glb_action (id, code, name, enabled) VALUES
  (1, 'lying',    '躺卧动画', 1),
  (2, 'eating',   '进食动画', 1),
  (3, 'sitting',  '坐动画',   1),
  (4, 'walking',  '行走动画', 1),
  (5, 'standing', '站立动画', 1),
  (6, 'feed',     '喂食反馈动画', 1),
  (7, 'play',     '逗猫反馈动画', 1),
  (8, 'clean',    '清洁反馈动画', 1);

-- 背景资源
CREATE TABLE IF NOT EXISTS t_pet_background (
  id          BIGINT        PRIMARY KEY COMMENT 'Snowflake ID',
  name        VARCHAR(100)  NOT NULL,
  image_url   VARCHAR(500)  NOT NULL,
  enabled     TINYINT       NOT NULL DEFAULT 1,
  deleted     TINYINT       NOT NULL DEFAULT 0,
  created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME      ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_enabled (enabled)
) ENGINE=InnoDB COMMENT='电子宠物背景资源';

-- 形象（GLB模型）资源
CREATE TABLE IF NOT EXISTS t_pet_model (
  id            BIGINT        PRIMARY KEY COMMENT 'Snowflake ID',
  name          VARCHAR(100)  NOT NULL,
  glb_url       VARCHAR(500)  NOT NULL COMMENT '形象 GLB 文件 OSS 直链',
  thumbnail_url VARCHAR(500)  COMMENT '预览缩略图',
  enabled       TINYINT       NOT NULL DEFAULT 1,
  deleted       TINYINT       NOT NULL DEFAULT 0,
  created_at    DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_enabled (enabled)
) ENGINE=InnoDB COMMENT='电子宠物形象（GLB模型）资源';

-- 互动类型（喂食/逗猫/清洁等）：后台可自由增删改查，预置3条初始数据但不限制数量
CREATE TABLE IF NOT EXISTS t_pet_interaction_type (
  id                BIGINT        PRIMARY KEY COMMENT 'Snowflake ID',
  code              VARCHAR(50)   NOT NULL COMMENT '标识码，管理员可自定义新增',
  name              VARCHAR(50)   NOT NULL COMMENT '显示名称',
  icon_url          VARCHAR(500)  COMMENT '图标',
  glb_action_id     BIGINT        NULL COMMENT '引用 t_pet_glb_action.id，为空表示未映射动画',
  satiety_delta     INT           NOT NULL DEFAULT 0 COMMENT '饱腹度增减（可正可负）',
  mood_delta        INT           NOT NULL DEFAULT 0 COMMENT '心情值增减（可正可负）',
  cleanliness_delta INT           NOT NULL DEFAULT 0 COMMENT '清洁度增减（可正可负）',
  enabled           TINYINT       NOT NULL DEFAULT 1,
  deleted           TINYINT       NOT NULL DEFAULT 0,
  created_at        DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME      ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_code (code),
  INDEX idx_enabled (enabled),
  INDEX idx_glb_action (glb_action_id)
) ENGINE=InnoDB COMMENT='电子宠物互动类型（喂食/逗猫/清洁等，后台可增删改查）';

INSERT IGNORE INTO t_pet_interaction_type (id, code, name, icon_url, glb_action_id, satiety_delta, mood_delta, cleanliness_delta, enabled) VALUES
  (1, 'feed',  '喂食', '', 6, 20, 5,  0,  1),
  (2, 'play',  '逗猫', '', 7, 0,  15, 0,  1),
  (3, 'clean', '清洁', '', 8, 0,  5,  20, 1);

-- 硬件动作码（躺卧/进食/坐/行走/站立等）：硬件/算法侦测出的宠物物理状态标识，非动画本身
-- 后台可自由增删改查，预置5条初始数据，硬件支持新动作时可继续新增
CREATE TABLE IF NOT EXISTS t_pet_hardware_action_type (
  id            BIGINT        PRIMARY KEY COMMENT 'Snowflake ID',
  code          VARCHAR(50)   NOT NULL COMMENT '标识码，管理员可自定义新增',
  name          VARCHAR(50)   NOT NULL COMMENT '显示名称',
  icon_url      VARCHAR(500)  COMMENT '图标',
  glb_action_id BIGINT        NULL COMMENT '引用 t_pet_glb_action.id，为空表示未映射动画',
  enabled       TINYINT       NOT NULL DEFAULT 1,
  deleted       TINYINT       NOT NULL DEFAULT 0,
  created_at    DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_code (code),
  INDEX idx_enabled (enabled),
  INDEX idx_glb_action (glb_action_id)
) ENGINE=InnoDB COMMENT='硬件动作码（宠物物理状态标识，后台可增删改查）';

INSERT IGNORE INTO t_pet_hardware_action_type (id, code, name, icon_url, glb_action_id, enabled) VALUES
  (1, 'lying',    '躺卧', '', 1, 1),
  (2, 'eating',   '进食', '', 2, 1),
  (3, 'sitting',  '坐',   '', 3, 1),
  (4, 'walking',  '行走', '', 4, 1),
  (5, 'standing', '站立', '', 5, 1);

-- 统一宠物事件日志：互动触发 + 硬件动作上报，统一记录，便于后台一处查询
CREATE TABLE IF NOT EXISTS t_pet_event (
  id           BIGINT                              PRIMARY KEY COMMENT 'Snowflake ID',
  source       ENUM('interaction','hardware_action') NOT NULL COMMENT '事件来源：互动触发/硬件动作上报',
  pet_id       BIGINT                              NULL COMMENT '关联宠物（互动事件必有；硬件事件按设备反查，可能为空）',
  device_id    BIGINT                              NULL COMMENT '关联设备（硬件事件必有；互动事件可选）',
  ref_type_id  BIGINT                              NOT NULL COMMENT 'source=interaction 时指向 t_pet_interaction_type.id；source=hardware_action 时指向 t_pet_hardware_action_type.id',
  occurred_at  DATETIME                            NOT NULL COMMENT '事件发生时间',
  created_at   DATETIME      DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pet (pet_id),
  INDEX idx_device (device_id),
  INDEX idx_occurred (occurred_at),
  INDEX idx_source (source)
) ENGINE=InnoDB COMMENT='宠物事件统一日志（互动触发 + 硬件动作上报）';
