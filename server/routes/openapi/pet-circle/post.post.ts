// POST /openapi/pet-circle/post — AI 服务上传萌宠圈自动动态
//
// 鉴权：server/middleware/openapi-auth.ts 统一校验
// Body:
// {
//   ownerUserId?: string, alias?: string,
//   petId: string, petName?: string, petAvatar?: string,
//   content: string,
//   mediaType?: "text" | "image" | "video" | 0 | 1 | 2,
//   mediaUrls?: string[],
//   coverUrl?: string,
//   eventType?: string,
//   sourceId?: string,
//   sourceTime?: string
// }

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) || {}
  const petId = String(body.petId ?? body.pet_id ?? '').trim()
  if (!petId) throw createError({ statusCode: 400, message: 'petId 不能为空' })

  const mediaType = normalizePetCircleMediaType(body.mediaType ?? body.media_type)
  const mediaUrls = normalizePetCircleMediaUrls(body.mediaUrls ?? body.media_urls)
  const content = String(body.content ?? '').trim()
  if (!content && mediaUrls.length === 0 && !String(body.coverUrl ?? body.cover_url ?? '').trim()) {
    throw createError({ statusCode: 400, message: 'content 或媒体内容至少提供一个' })
  }

  const db = useDb()
  await ensurePetCirclePostTable(db)

  const ownerUserId = await resolvePetCircleOwnerId(db, body)
  const petName = String(body.petName ?? body.pet_name ?? '').trim().slice(0, 80)
  const petAvatar = String(body.petAvatar ?? body.pet_avatar ?? '').trim().slice(0, 500)
  const coverUrl = String(body.coverUrl ?? body.cover_url ?? '').trim().slice(0, 500)
  const eventType = String(body.eventType ?? body.event_type ?? 'ai_daily').trim().slice(0, 40) || 'ai_daily'
  const sourceIdRaw = body.sourceId ?? body.source_id
  const sourceId = sourceIdRaw == null ? null : String(sourceIdRaw).trim().slice(0, 120) || null
  const sourceTime = normalizeSourceDateTime(body.sourceTime ?? body.source_time)
  const mediaJson = mediaUrls.length ? JSON.stringify(mediaUrls) : null
  const mediaCode = petCircleMediaTypeCode(mediaType)

  if (sourceId) {
    const [[existing]]: any = await db.query(
      `SELECT id FROM t_pet_circle_post
       WHERE owner_user_id = ? AND pet_id = ? AND event_type = ? AND source_id = ? LIMIT 1`,
      [ownerUserId, petId, eventType, sourceId],
    )
    if (existing?.id) {
      await db.query(
        `UPDATE t_pet_circle_post
         SET pet_name=?, pet_avatar=?, content=?, media_type=?, media_urls=?,
             cover_url=?, source_time=?, status=1, updated_at=NOW()
         WHERE id=?`,
        [petName, petAvatar, content, mediaCode, mediaJson, coverUrl, sourceTime, existing.id],
      )
      return {
        success: true,
        id: String(existing.id),
        updated: true,
      }
    }
  }

  const [result]: any = await db.query(
    `INSERT INTO t_pet_circle_post
       (owner_user_id, pet_id, pet_name, pet_avatar, content, media_type,
        media_urls, cover_url, event_type, source_id, source_time)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ownerUserId,
      petId,
      petName,
      petAvatar,
      content,
      mediaCode,
      mediaJson,
      coverUrl,
      eventType,
      sourceId,
      sourceTime,
    ],
  )

  return {
    success: true,
    id: String(result.insertId),
    updated: false,
  }
})
