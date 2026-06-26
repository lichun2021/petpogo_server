import { randomBytes } from 'node:crypto'

export const SHARE_TYPES = ['pet', 'device', 'location', 'capture', 'greeting'] as const
export type ShareType = typeof SHARE_TYPES[number]

export interface ShareTargetSummary {
  targetId: string
  title: string
  description: string
  imageUrl: string
  publicPayload: Record<string, any>
}

let _shareTableReady: Promise<void> | null = null

export async function ensureShareLinkTable(db = useDb()) {
  if (!_shareTableReady) {
    _shareTableReady = db.query(`
      CREATE TABLE IF NOT EXISTS t_share_link (
        id            BIGINT       PRIMARY KEY AUTO_INCREMENT,
        code          VARCHAR(32)  NOT NULL COMMENT '分享短码',
        user_id       BIGINT       NOT NULL COMMENT '创建分享的用户ID',
        share_type    VARCHAR(32)  NOT NULL COMMENT 'pet/device/location/capture/greeting',
        target_id     VARCHAR(80)  NOT NULL COMMENT '业务对象ID或设备MAC',
        title         VARCHAR(120) NOT NULL DEFAULT '',
        description   VARCHAR(300) NOT NULL DEFAULT '',
        image_url     VARCHAR(500) NOT NULL DEFAULT '',
        payload       JSON         NULL COMMENT '只放公开展示所需摘要，不放敏感权限',
        expire_at     DATETIME     NOT NULL,
        status        TINYINT      NOT NULL DEFAULT 1 COMMENT '1正常 0失效',
        created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP,
        updated_at    DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_code (code),
        INDEX idx_user (user_id),
        INDEX idx_type_target (share_type, target_id),
        INDEX idx_expire (expire_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='App业务分享链接';
    `).then(() => undefined)
  }
  return _shareTableReady
}

export function normalizeShareType(value: unknown): ShareType {
  const type = String(value || '').trim().toLowerCase()
  if ((SHARE_TYPES as readonly string[]).includes(type)) return type as ShareType
  throw createError({ statusCode: 400, message: '分享类型无效' })
}

export function normalizeShareCode(value: unknown): string {
  const code = String(value || '').trim()
  if (!/^[A-Za-z0-9_-]{8,32}$/.test(code)) {
    throw createError({ statusCode: 400, message: '分享码无效' })
  }
  return code
}

function normalizeShareSiteBaseUrl(value: unknown) {
  return String(value || 'https://www.jxpetai.com')
    .replace(/^https:\/\/(www\.)?freepetai\.com/i, 'https://www.jxpetai.com')
    .replace(/\/+$/, '')
}

export function shareDeepLink(type: ShareType, code: string) {
  return `petpogo://share?type=${encodeURIComponent(type)}&code=${encodeURIComponent(code)}`
}

export function sharePageUrl(
  code: string,
  options: { type?: ShareType; title?: string; description?: string; imageUrl?: string } = {},
) {
  const config = useRuntimeConfig()
  const base = normalizeShareSiteBaseUrl(config.siteBaseUrl)
  const params = new URLSearchParams({ code })
  if (options.type) params.set('type', options.type)
  if (options.title) params.set('title', options.title)
  if (options.description) params.set('desc', options.description)
  if (options.imageUrl) params.set('image', options.imageUrl)
  return `${base}/share.html?${params.toString()}`
}

export async function generateShareCode(db = useDb()) {
  for (let i = 0; i < 8; i++) {
    const code = randomBytes(9).toString('base64url')
    const [[row]]: any = await db.query('SELECT id FROM t_share_link WHERE code=? LIMIT 1', [code])
    if (!row) return code
  }
  throw createError({ statusCode: 500, message: '分享码生成失败，请重试' })
}

export async function loadShareTargetSummary(
  db: any,
  type: ShareType,
  targetId: string,
  userId: string,
): Promise<ShareTargetSummary> {
  switch (type) {
    case 'pet':
      return loadPetSummary(db, targetId, userId)
    case 'device':
      return loadDeviceSummary(db, targetId, userId, false)
    case 'location':
      return loadDeviceSummary(db, targetId, userId, true)
    case 'capture':
      return loadCaptureSummary(db, targetId, userId)
    case 'greeting':
      return loadGreetingSummary(db, targetId, userId)
  }
}

async function loadPetSummary(db: any, targetId: string, userId: string): Promise<ShareTargetSummary> {
  const [[pet]]: any = await db.query(
    `SELECT id, name, avatar, species, breed, device_id
     FROM t_pet WHERE id=? AND user_id=? AND deleted=0 LIMIT 1`,
    [targetId, userId],
  )
  if (!pet) throw createError({ statusCode: 404, message: '宠物不存在或无权分享' })

  const name = safeText(pet.name, '宠物')
  return {
    targetId: String(pet.id),
    title: `邀请你一起守护${name}`,
    description: `${name}的资料、位置和动态都在萌宠智伴里。`,
    imageUrl: safeText(pet.avatar),
    publicPayload: {
      petName: name,
      species: safeText(pet.species),
      breed: safeText(pet.breed),
    },
  }
}

async function loadDeviceSummary(
  db: any,
  targetId: string,
  userId: string,
  asLocation: boolean,
): Promise<ShareTargetSummary> {
  const [[device]]: any = await db.query(
    `SELECT d.id, d.mac, d.name, d.online_status, d.longitude, d.latitude, d.address,
            d.last_online_at, ud.nickname AS bind_name, ud.u_type
     FROM t_user_device ud
     JOIN t_device d ON ud.device_id = d.id
     WHERE ud.user_id=? AND d.deleted=0 AND (CAST(d.id AS CHAR)=? OR d.mac=?)
     LIMIT 1`,
    [userId, targetId, targetId],
  )
  if (!device) throw createError({ statusCode: 404, message: '设备不存在或无权分享' })

  const name = firstText(device.bind_name, device.name, device.mac, '设备')
  if (asLocation) {
    const address = safeText(device.address, '点击查看宠物最新位置')
    return {
      targetId: String(device.mac),
      title: `${name}的位置分享`,
      description: address,
      imageUrl: '',
      publicPayload: {
        deviceName: name,
        address,
        online: Boolean(device.online_status),
        updateTime: device.last_online_at || null,
      },
    }
  }

  return {
    targetId: String(device.id),
    title: `邀请你共享设备${name}`,
    description: '一起管理宠物设备、查看状态和照看宠物。',
    imageUrl: '',
    publicPayload: {
      deviceName: name,
      mac: safeText(device.mac),
      online: Boolean(device.online_status),
    },
  }
}

async function loadCaptureSummary(db: any, targetId: string, userId: string): Promise<ShareTargetSummary> {
  const [[row]]: any = await db.query(
    `SELECT id, device_id, event_type, resource_url, cover_url, ai_result, created_at
     FROM t_capture_event WHERE id=? AND user_id=? AND status=1 LIMIT 1`,
    [targetId, userId],
  )
  if (!row) throw createError({ statusCode: 404, message: '抓拍记录不存在或无权分享' })

  const emotion = extractEmotion(row.ai_result)
  return {
    targetId: String(row.id),
    title: '分享一个宠物抓拍瞬间',
    description: emotion ? `AI识别到宠物可能是${emotion}，点击查看详情。` : '看看宠物刚刚被抓拍到的可爱瞬间。',
    imageUrl: firstText(row.cover_url, row.resource_url),
    publicPayload: {
      eventType: safeText(row.event_type),
      emotion,
      createdAt: row.created_at || null,
    },
  }
}

async function loadGreetingSummary(db: any, targetId: string, userId: string): Promise<ShareTargetSummary> {
  const [[row]]: any = await db.query(
    `SELECT id, device_id, resource_url, response_url, cover_url, ai_result, created_at
     FROM t_greeting_event WHERE id=? AND user_id=? AND status=1 LIMIT 1`,
    [targetId, userId],
  )
  if (!row) throw createError({ statusCode: 404, message: '打招呼记录不存在或无权分享' })

  const emotion = extractEmotion(row.ai_result)
  return {
    targetId: String(row.id),
    title: '分享一次宠物打招呼',
    description: emotion ? `宠物回应里藏着${emotion}，点击查看这个瞬间。` : '看看宠物对我的打招呼有什么回应。',
    imageUrl: firstText(row.cover_url, row.response_url),
    publicPayload: {
      emotion,
      createdAt: row.created_at || null,
    },
  }
}

export function toPublicShare(row: any) {
  const type = normalizeShareType(row.share_type)
  const code = normalizeShareCode(row.code)
  return {
    code,
    type,
    title: safeText(row.title, '萌宠智伴分享'),
    description: safeText(row.description, '点击打开萌宠智伴查看详情。'),
    imageUrl: safeText(row.image_url),
    deepLink: shareDeepLink(type, code),
    payload: parseJson(row.payload) || {},
    expiresAt: row.expire_at || null,
    createdAt: row.created_at || null,
  }
}

export function parseJson(value: any): any | null {
  if (!value) return null
  if (typeof value === 'object') return value
  try { return JSON.parse(String(value)) } catch { return null }
}

function extractEmotion(value: any): string {
  const ai = parseJson(value) || value
  if (!ai || typeof ai !== 'object') return ''
  const top = ai.top || ai.emotion || ai.result || null
  if (typeof top === 'string') return top
  if (top && typeof top === 'object') {
    return firstText(
      top.name,
      top.label,
      top.emotion,
      top.cn,
      [top.emoji, top.name].filter(Boolean).join(''),
    )
  }
  return firstText(ai.name, ai.label, ai.emotion)
}

function firstText(...values: any[]): string {
  for (const value of values) {
    const text = safeText(value)
    if (text) return text
  }
  return ''
}

function safeText(value: any, fallback = ''): string {
  const text = value == null ? '' : String(value).trim()
  return text || fallback
}
