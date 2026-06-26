export type PetCircleMediaType = 'text' | 'image' | 'video'

let _petCircleTableReady: Promise<void> | null = null

export async function ensurePetCirclePostTable(db = useDb()) {
  if (!_petCircleTableReady) {
    _petCircleTableReady = db.query(`
      CREATE TABLE IF NOT EXISTS t_pet_circle_post (
        id             BIGINT       PRIMARY KEY AUTO_INCREMENT,
        owner_user_id  BIGINT       NOT NULL COMMENT '宠物主人用户ID',
        pet_id         VARCHAR(80)  NOT NULL COMMENT '宠物ID，可来自 PeerApi',
        pet_name       VARCHAR(80)  NOT NULL DEFAULT '',
        pet_avatar     VARCHAR(500) NOT NULL DEFAULT '',
        content        TEXT         NOT NULL,
        media_type     TINYINT      NOT NULL DEFAULT 0 COMMENT '0文字 1图片 2视频',
        media_urls     JSON         NULL COMMENT '图片或视频地址列表',
        cover_url      VARCHAR(500) NOT NULL DEFAULT '',
        event_type     VARCHAR(40)  NOT NULL DEFAULT 'ai_daily',
        source_id      VARCHAR(120) NULL COMMENT 'AI/设备侧幂等来源ID',
        source_time    DATETIME     NULL,
        status         TINYINT      NOT NULL DEFAULT 1 COMMENT '1正常 0删除',
        created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_source (owner_user_id, pet_id, event_type, source_id),
        INDEX idx_owner_pet_time (owner_user_id, pet_id, status, created_at),
        INDEX idx_pet_time (pet_id, status, created_at),
        INDEX idx_source_time (source_time)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='萌宠圈自动动态';
    `).then(() => undefined)
  }
  return _petCircleTableReady
}

export function normalizePetCircleMediaType(value: unknown): PetCircleMediaType {
  if (typeof value === 'number') {
    if (value === 1) return 'image'
    if (value === 2) return 'video'
    return 'text'
  }
  const raw = String(value || 'text').trim().toLowerCase()
  if (raw === '1' || raw === 'image' || raw === 'images') return 'image'
  if (raw === '2' || raw === 'video') return 'video'
  return 'text'
}

export function petCircleMediaTypeCode(type: PetCircleMediaType) {
  if (type === 'image') return 1
  if (type === 'video') return 2
  return 0
}

export function petCircleMediaTypeName(code: unknown): PetCircleMediaType {
  const n = Number(code)
  if (n === 1) return 'image'
  if (n === 2) return 'video'
  return 'text'
}

export function normalizePetCircleMediaUrls(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 9)
  }
  if (typeof value === 'string') {
    const raw = value.trim()
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return normalizePetCircleMediaUrls(parsed)
    } catch {}
    return raw.split(/[,，\s]+/).map((item) => item.trim()).filter(Boolean).slice(0, 9)
  }
  return []
}

export function parsePetCircleMediaUrls(value: unknown): string[] {
  if (Array.isArray(value)) return normalizePetCircleMediaUrls(value)
  if (typeof value === 'string' && value.trim()) {
    try {
      return normalizePetCircleMediaUrls(JSON.parse(value))
    } catch {
      return normalizePetCircleMediaUrls(value)
    }
  }
  return []
}

export function normalizeSourceDateTime(value: unknown) {
  if (value == null || value === '') return null
  const date = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(date.getTime())) return null
  const pad = (n: number) => String(n).padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + ' ' + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join(':')
}

export async function resolvePetCircleOwnerId(db: any, body: Record<string, any>) {
  const direct = body.ownerUserId ?? body.owner_user_id ?? body.userId ?? body.user_id
  if (direct != null && String(direct).trim()) return String(direct).trim()

  const aliasRaw = body.alias ?? body.phone ?? body.mobile
  if (aliasRaw != null && String(aliasRaw).trim()) {
    const alias = String(aliasRaw).trim()
    const phone = alias.includes('@') ? alias.split('@')[0].trim() : alias
    const [[user]]: any = await db.query(
      'SELECT id FROM t_user WHERE phone = ? AND deleted = 0 LIMIT 1',
      [phone],
    )
    if (user?.id) return String(user.id)
  }

  const petId = body.petId ?? body.pet_id
  if (petId != null && String(petId).trim()) {
    const [[pet]]: any = await db.query(
      'SELECT user_id FROM t_pet WHERE id = ? AND deleted = 0 LIMIT 1',
      [String(petId).trim()],
    )
    if (pet?.user_id) return String(pet.user_id)
  }

  throw createError({ statusCode: 400, message: 'ownerUserId、alias 或有效 petId 必须提供一个' })
}

export function mapPetCirclePost(row: any) {
  const mediaType = petCircleMediaTypeName(row.media_type)
  return {
    id: String(row.id),
    ownerUserId: row.owner_user_id != null ? String(row.owner_user_id) : '',
    petId: row.pet_id != null ? String(row.pet_id) : '',
    petName: row.pet_name || '',
    petAvatar: row.pet_avatar || '',
    content: row.content || '',
    mediaType,
    mediaUrls: parsePetCircleMediaUrls(row.media_urls),
    coverUrl: row.cover_url || '',
    eventType: row.event_type || 'ai_daily',
    sourceId: row.source_id || '',
    sourceTime: row.source_time,
    createdAt: row.created_at,
  }
}
