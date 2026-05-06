export default defineEventHandler(async (event) => {
  const { page = 1, size = 20, search = '', category = '', status = '' } = getQuery(event)
  const db = useDb()
  const offset = (Number(page) - 1) * Number(size)

  const conditions: string[] = []
  const params: any[] = []

  if (search) {
    conditions.push('(name LIKE ? OR address LIKE ?)')
    params.push(`%${search}%`, `%${search}%`)
  }
  if (category) { conditions.push('category LIKE ?'); params.push(`%${category}%`) }
  if (status !== '') { conditions.push('status = ?'); params.push(Number(status)) }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const [[{ total }]]: any = await db.query(`SELECT COUNT(*) as total FROM t_store ${where}`, params)
  const [list]: any = await db.query(
    `SELECT id, name, address, category, latitude, longitude, phone, rating, is_hot, status FROM t_store ${where} ORDER BY is_hot DESC, created_at DESC LIMIT ? OFFSET ?`,
    [...params, Number(size), offset]
  )

  return { list: list.map((s: any) => ({ ...s, id: String(s.id) })), total }
})
