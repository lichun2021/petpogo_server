export default defineEventHandler(async (event) => {
  const { page = 1, size = 20, search = '', online = '' } = getQuery(event)
  const db = useDb()
  const offset = (Number(page) - 1) * Number(size)

  let where = 'WHERE deleted=0'
  const params: any[] = []
  if (search) { where += ' AND (mac LIKE ? OR name LIKE ?)'; params.push(`%${search}%`, `%${search}%`) }
  if (online !== '') { where += ' AND online_status=?'; params.push(Number(online)) }

  const [[{ total }]]: any = await db.query(`SELECT COUNT(*) as total FROM t_device ${where}`, params)
  const [list]: any = await db.query(
    `SELECT d.id, d.mac, d.name, d.online_status, d.last_online_at, d.longitude, d.latitude, d.address
     FROM t_device d ${where} ORDER BY d.online_status DESC, d.last_online_at DESC LIMIT ? OFFSET ?`,
    [...params, Number(size), offset]
  )

  return { list: list.map((d: any) => ({ ...d, id: String(d.id) })), total: Number(total) }
})
