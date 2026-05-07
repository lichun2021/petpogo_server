// GET /sdkapi/ai/history
// 查询当前用户的 AI 分析历史记录（音频 + 图片）
//
// Query 参数：
//   type?   'voice' | 'image'  不传则返回全部
//   petId?  string             按宠物过滤
//   page?   number             页码（默认1）
//   limit?  number             每页条数（默认20，最大50）

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const query = getQuery(event)

  const type   = String(query.type  || '')
  const petId  = query.petId ? String(query.petId) : null
  const page   = Math.max(1, Number(query.page)  || 1)
  const limit  = Math.min(50, Math.max(1, Number(query.limit) || 20))
  const offset = (page - 1) * limit

  const db = useDb()
  const results: any[] = []

  // ── 音频记录 ─────────────────────────────────────
  if (!type || type === 'voice') {
    const whereParts = ['user_id = ?']
    const whereParams: any[] = [user.userId]
    if (petId) { whereParts.push('pet_id = ?'); whereParams.push(petId) }

    const [rows]: any = await db.query(
      `SELECT id, pet_id, audio_url, species, species_conf,
              emotion, emotion_zh, emotion_conf, top3, advice, processing_ms, created_at
       FROM t_pet_voice_analysis
       WHERE ${whereParts.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...whereParams, limit, offset]
    )
    for (const r of rows) {
      results.push({
        ...r,
        id:     String(r.id),
        pet_id: r.pet_id ? String(r.pet_id) : null,
        mediaType: 'voice',
        top3: typeof r.top3 === 'string' ? JSON.parse(r.top3) : r.top3,
      })
    }
  }

  // ── 图片记录 ─────────────────────────────────────
  if (!type || type === 'image') {
    const whereParts = ['user_id = ?']
    const whereParams: any[] = [user.userId]
    if (petId) { whereParts.push('pet_id = ?'); whereParams.push(petId) }

    const [rows]: any = await db.query(
      `SELECT id, pet_id, image_url,
              emotion, emotion_zh, emotion_conf, top3, advice, ensemble_size, processing_ms, created_at
       FROM t_pet_image_analysis
       WHERE ${whereParts.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...whereParams, limit, offset]
    )
    for (const r of rows) {
      results.push({
        ...r,
        id:     String(r.id),
        pet_id: r.pet_id ? String(r.pet_id) : null,
        mediaType: 'image',
        top3: typeof r.top3 === 'string' ? JSON.parse(r.top3) : r.top3,
      })
    }
  }

  // 混合时按时间倒序
  results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return { list: results.slice(0, limit), page, limit }
})
