// 附近门店查询（MySQL 空间索引）
export default defineEventHandler(async (event) => {
  const { lng, lat, radius = 5000, category = '', page = 1, size = 20 } = getQuery(event)
  if (!lng || !lat) throw createError({ statusCode: 400, message: '缺少经纬度参数' })

  const db = useDb()
  const offset = (Number(page) - 1) * Number(size)
  const params: any[] = [`POINT(${Number(lng)} ${Number(lat)})`, `POINT(${Number(lng)} ${Number(lat)})`, Number(radius)]
  let catWhere = ''
  if (category) { catWhere = 'AND category=?'; params.push(category) }

  const [stores]: any = await db.query(
    `SELECT id, name, category, cover, address, phone, rating, review_count, business_hours, longitude, latitude,
            ROUND(ST_Distance_Sphere(location, ST_GeomFromText(?))) AS distance
     FROM t_store
     WHERE status=1
       AND ST_Distance_Sphere(location, ST_GeomFromText(?)) <= ?
       ${catWhere}
     ORDER BY distance ASC
     LIMIT ? OFFSET ?`,
    [...params, Number(size), offset]
  )

  return {
    list: stores.map((s: any) => ({ ...s, id: String(s.id) })),
    page: Number(page),
    size: Number(size),
  }
})
