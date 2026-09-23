export async function up(db) {
  async function column(table,name,definition) {
    const [rows]=await db.query('SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?',[table,name])
    if(!rows.length)await db.query(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`)
  }
  await db.query('ALTER TABLE t_user MODIFY COLUMN password VARCHAR(255) NULL')
  await column('t_user','credential_version','INT UNSIGNED NOT NULL DEFAULT 0')
  // 首次撤销默认或空密码账号的旧会话；不重置已设置的个人密码。
  await db.query("UPDATE t_user SET password=NULL,credential_version=credential_version+1 WHERE credential_version=0 AND (password IS NULL OR password='' OR password=MD5('123456'))")
  await db.query(`CREATE TABLE IF NOT EXISTS t_points_operation (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    source VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    event_id VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    user_id BIGINT NOT NULL, request_hash CHAR(64) NOT NULL,
    amount INT NULL, rule_snapshot JSON NULL, result JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_source_event(source,event_id), INDEX idx_user(user_id)
  ) ENGINE=InnoDB`)
  await db.query(`CREATE TABLE IF NOT EXISTS t_pet_model_assignment (
    id TINYINT PRIMARY KEY,default_model_id BIGINT NULL,default_cat_model_id BIGINT NULL,default_dog_model_id BIGINT NULL,
    rules JSON NOT NULL,breed_mappings JSON NOT NULL,revision INT UNSIGNED NOT NULL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB`)
  await column('t_pet_model_assignment','default_cat_model_id','BIGINT NULL')
  await column('t_pet_model_assignment','default_dog_model_id','BIGINT NULL')
  await column('t_pet_model_assignment','revision','INT UNSIGNED NOT NULL DEFAULT 0')
  for(const [name,type] of [['model_snapshot','JSON'],['model_assignment_source','VARCHAR(20)'],['model_rule_name','VARCHAR(100)'],['model_assigned_at','DATETIME']]) await column('t_pet',name,`${type} NULL`)
  await db.query('INSERT IGNORE INTO t_pet_model_assignment(id,rules,breed_mappings) VALUES(1,JSON_ARRAY(),JSON_ARRAY())')
  await db.query(`UPDATE t_pet p JOIN t_pet_model m ON m.id=p.model_id SET p.model_snapshot=JSON_OBJECT('id',CAST(m.id AS CHAR),'name',m.name,'glb_url',m.glb_url,'thumbnail_url',m.thumbnail_url),p.model_assignment_source='legacy',p.model_assigned_at=NOW() WHERE p.model_snapshot IS NULL`)
}
