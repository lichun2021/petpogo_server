// 旧设备不猜测通网类型，绑定时提供明确值后再更新。
export async function up(db) {
  const [rows] = await db.query(
    'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?',
    ['t_device', 'network_type'],
  )
  if (!rows.length) await db.query("ALTER TABLE t_device ADD COLUMN network_type ENUM('4g','wifi') NULL COMMENT '通网类型，NULL表示未设置' AFTER wifi_version")
}
