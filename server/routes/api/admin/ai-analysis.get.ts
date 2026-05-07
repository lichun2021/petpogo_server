// GET /api/admin/ai-analysis
// 管理后台：查询 AI 识别记录（图片 + 音频）

export default defineEventHandler(async (event) => {
  const {
    type   = '',     // 'image' | 'voice' | '' 全部
    page   = 1,
    size   = 20,
    userId = '',     // 按用户 ID 过滤
    success = '',    // 'true' | 'false' | '' 全部（仅图片有 emotion 字段可判断）
  } = getQuery(event)

  const db = useDb()
  const offset = (Number(page) - 1) * Number(size)
  const limit  = Number(size)

  const rows: any[] = []

  // ── 图片记录 ─────────────────────────────────────
  if (!type || type === 'image') {
    let where = 'WHERE 1=1'
    const params: any[] = []
    if (userId) { where += ' AND a.user_id = ?'; params.push(userId) }
    if (success === 'true')  { where += ' AND a.emotion IS NOT NULL' }
    if (success === 'false') { where += ' AND a.emotion IS NULL' }

    const [list]: any = await db.query(
      `SELECT a.id, a.user_id, a.pet_id, a.image_url,
              a.emotion, a.emotion_zh, a.emotion_conf,
              a.top3, a.advice, a.ensemble_size, a.processing_ms, a.created_at,
              u.nickname, u.avatar AS user_avatar
       FROM t_pet_image_analysis a
       LEFT JOIN t_user u ON u.id = a.user_id
       ${where}
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    for (const r of list) {
      rows.push({
        ...r,
        id:       String(r.id),
        user_id:  String(r.user_id),
        pet_id:   r.pet_id ? String(r.pet_id) : null,
        mediaType: 'image',
        success:  !!r.emotion,
        top3: typeof r.top3 === 'string' ? JSON.parse(r.top3) : (r.top3 ?? []),
      })
    }
  }

  // ── 音频记录 ─────────────────────────────────────
  if (!type || type === 'voice') {
    let where = 'WHERE 1=1'
    const params: any[] = []
    if (userId) { where += ' AND a.user_id = ?'; params.push(userId) }
    if (success === 'true')  { where += ' AND a.emotion IS NOT NULL' }
    if (success === 'false') { where += ' AND a.emotion IS NULL' }

    const [list]: any = await db.query(
      `SELECT a.id, a.user_id, a.pet_id, a.audio_url,
              a.species, a.species_conf,
              a.emotion, a.emotion_zh, a.emotion_conf,
              a.top3, a.advice, a.processing_ms, a.created_at,
              u.nickname, u.avatar AS user_avatar
       FROM t_pet_voice_analysis a
       LEFT JOIN t_user u ON u.id = a.user_id
       ${where}
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    for (const r of list) {
      rows.push({
        ...r,
        id:       String(r.id),
        user_id:  String(r.user_id),
        pet_id:   r.pet_id ? String(r.pet_id) : null,
        mediaType: 'voice',
        success:  !!r.emotion,
        top3: typeof r.top3 === 'string' ? JSON.parse(r.top3) : (r.top3 ?? []),
      })
    }
  }

  // 混合时按时间倒序，截取当前页
  rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  // 统计总量（简版：直接用当前结果数）
  const [[imgCount]]: any = await db.query('SELECT COUNT(*) as c FROM t_pet_image_analysis')
  const [[voiceCount]]: any = await db.query('SELECT COUNT(*) as c FROM t_pet_voice_analysis')

  return {
    list:       rows.slice(0, limit),
    totalImage: Number(imgCount.c),
    totalVoice: Number(voiceCount.c),
    page:       Number(page),
    size:       limit,
  }
})
