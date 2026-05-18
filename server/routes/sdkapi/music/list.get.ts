// GET /sdkapi/music/list?petType=cat|dog|all
// 按分类返回上架音乐，可按宠物类型筛选
// petType 不传 → 返回全部；传 cat/dog → 返回该类型 + all 通用
export default defineEventHandler(async (event) => {
  const { petType = '' } = getQuery(event) as { petType?: string }
  const db = useDb()

  const [catRows]: any = await db.query(
    'SELECT id, name, icon_url, sort_order FROM t_music_category ORDER BY sort_order ASC, id ASC'
  )
  if (!catRows.length) return { categories: [] }

  let whereExtra = ''
  const params: any[] = []
  if (petType && petType !== 'all') {
    whereExtra = "AND m.pet_type IN ('all', ?)"
    params.push(petType)
  }

  const [musicRows]: any = await db.query(`
    SELECT m.id, m.category_id, m.name, m.icon_url, m.music_url, m.duration, m.pet_type, m.sort_order
    FROM t_music m
    WHERE m.status = 1 ${whereExtra}
    ORDER BY m.sort_order ASC, m.id ASC
  `, params)

  const musicByCat: Record<number, any[]> = {}
  for (const m of musicRows) {
    if (!musicByCat[m.category_id]) musicByCat[m.category_id] = []
    musicByCat[m.category_id].push({
      id:       Number(m.id),
      name:     m.name,
      iconUrl:  m.icon_url,
      musicUrl: m.music_url,
      duration: m.duration,
      petType:  m.pet_type,
    })
  }

  const categories = catRows
    .map((c: any) => ({
      id:        c.id,
      name:      c.name,
      iconUrl:   c.icon_url,
      sortOrder: c.sort_order,
      music:     musicByCat[c.id] ?? [],
    }))
    .filter((c: any) => c.music.length > 0)

  return { categories }
})
