// GET /api/admin/points/config — 查询积分类型配置列表
export default defineEventHandler(async (event) => {
  const db = useDb()
  const [rows]: any = await db.query(
    `SELECT id, type_code, name, expire_days, sort_order, status
     FROM t_points_config ORDER BY sort_order ASC`
  )
  return { list: rows }
})
