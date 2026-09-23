// 只增加联系邮箱，不修改已有资料或登录凭证。
export async function up(db) {
  const [rows] = await db.query(
    'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?',
    ['t_user', 'email'],
  )
  if (!rows.length) await db.query("ALTER TABLE t_user ADD COLUMN email VARCHAR(254) NULL COMMENT '联系邮箱，非登录凭证' AFTER birthday")
}
