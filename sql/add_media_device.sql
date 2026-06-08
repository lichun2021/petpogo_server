-- 为 t_media 添加 device_id 字段
-- 执行方式：mysql -u root -p petpogo < sql/add_media_device.sql

USE petpogo;

ALTER TABLE t_media
  ADD COLUMN device_id BIGINT DEFAULT NULL COMMENT '关联设备ID（t_device.id）' AFTER user_id,
  ADD INDEX idx_device (device_id);
