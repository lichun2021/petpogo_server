-- 执行前备份数据库，并选中应用数据库。可重复执行，不覆盖已保存的规则或保底。
CREATE TABLE IF NOT EXISTS t_pet_model_assignment (
  id TINYINT PRIMARY KEY,
  default_model_id BIGINT NULL COMMENT '未知类型保底',
  default_cat_model_id BIGINT NULL COMMENT '默认猫形象',
  default_dog_model_id BIGINT NULL COMMENT '默认狗形象',
  rules JSON NOT NULL,
  breed_mappings JSON NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB COMMENT='宠物形象分配规则';

SET @pet_model_ddl = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='t_pet' AND COLUMN_NAME='model_snapshot'), 'SELECT 1', 'ALTER TABLE t_pet ADD COLUMN model_snapshot JSON NULL');
PREPARE pet_model_stmt FROM @pet_model_ddl;
EXECUTE pet_model_stmt;
DEALLOCATE PREPARE pet_model_stmt;

SET @pet_model_ddl = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='t_pet' AND COLUMN_NAME='model_assignment_source'), 'SELECT 1', 'ALTER TABLE t_pet ADD COLUMN model_assignment_source VARCHAR(20) NULL');
PREPARE pet_model_stmt FROM @pet_model_ddl;
EXECUTE pet_model_stmt;
DEALLOCATE PREPARE pet_model_stmt;

SET @pet_model_ddl = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='t_pet' AND COLUMN_NAME='model_rule_name'), 'SELECT 1', 'ALTER TABLE t_pet ADD COLUMN model_rule_name VARCHAR(100) NULL');
PREPARE pet_model_stmt FROM @pet_model_ddl;
EXECUTE pet_model_stmt;
DEALLOCATE PREPARE pet_model_stmt;

SET @pet_model_ddl = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='t_pet' AND COLUMN_NAME='model_assigned_at'), 'SELECT 1', 'ALTER TABLE t_pet ADD COLUMN model_assigned_at DATETIME NULL');
PREPARE pet_model_stmt FROM @pet_model_ddl;
EXECUTE pet_model_stmt;
DEALLOCATE PREPARE pet_model_stmt;

SET @pet_model_ddl = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='t_pet_model_assignment' AND COLUMN_NAME='default_cat_model_id'), 'SELECT 1', 'ALTER TABLE t_pet_model_assignment ADD COLUMN default_cat_model_id BIGINT NULL');
PREPARE pet_model_stmt FROM @pet_model_ddl;
EXECUTE pet_model_stmt;
DEALLOCATE PREPARE pet_model_stmt;

SET @pet_model_ddl = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='t_pet_model_assignment' AND COLUMN_NAME='default_dog_model_id'), 'SELECT 1', 'ALTER TABLE t_pet_model_assignment ADD COLUMN default_dog_model_id BIGINT NULL');
PREPARE pet_model_stmt FROM @pet_model_ddl;
EXECUTE pet_model_stmt;
DEALLOCATE PREPARE pet_model_stmt;

INSERT IGNORE INTO t_pet_model_assignment(id, rules, breed_mappings) VALUES(1, JSON_ARRAY(), JSON_ARRAY());
UPDATE t_pet p JOIN t_pet_model m ON m.id=p.model_id
SET p.model_snapshot=JSON_OBJECT('id',CAST(m.id AS CHAR),'name',m.name,'glb_url',m.glb_url,'thumbnail_url',m.thumbnail_url),
 p.model_assignment_source='legacy',p.model_assigned_at=NOW()
WHERE p.model_snapshot IS NULL;
-- 只延续未知类型保底；不猜测哪个模型是猫/狗，必须在后台明确选择。
UPDATE t_pet_model_assignment SET default_model_id=(SELECT id FROM t_pet_model WHERE deleted=0 AND enabled=1 ORDER BY created_at,id LIMIT 1) WHERE id=1 AND default_model_id IS NULL;
