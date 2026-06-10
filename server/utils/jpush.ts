// server/utils/jpush.ts — 极光推送服务端工具

const JPUSH_APP_KEY = 'bbff354f334f7c5e340b9c38'
const JPUSH_MASTER_SECRET = 'e18f5ba890aa0f2b7e506544'
const JPUSH_PUSH_URL = 'https://api.jpush.cn/v3/push'

// Basic Auth header
const AUTH_HEADER = `Basic ${Buffer.from(`${JPUSH_APP_KEY}:${JPUSH_MASTER_SECRET}`).toString('base64')}`

// ── 推送目标类型 ─────────────────────────────────────────────────────────────
export type PushAudience =
  | { type: 'all' }                         // 全体广播
  | { type: 'alias'; alias: string[] }    // 按用户 alias（建议用 userId）
  | { type: 'regid'; registrationId: string[] }  // 按设备注册 ID

// ── 推送参数 ─────────────────────────────────────────────────────────────────
export interface PushParams {
  audience: PushAudience
  title: string
  content: string
  /** 自定义 extras，App 端通知点击后可读取 */
  extras?: Record<string, string>
  /** 离线保留秒数，默认 86400 (24h)，0 = 不保留 */
  timeToLive?: number
}

// ── 推送结果 ─────────────────────────────────────────────────────────────────
export interface PushResult {
  sendno: string
  msg_id: string
}

// ── 核心推送函数 ─────────────────────────────────────────────────────────────
export async function jpushSend(params: PushParams): Promise<PushResult> {
  const { audience, title, content, extras = {}, timeToLive = 86400 } = params

  // 构造 audience 字段
  let audienceField: any
  if (audience.type === 'all') {
    audienceField = 'all'
  } else if (audience.type === 'alias') {
    audienceField = { alias: audience.alias }
  } else {
    audienceField = { registration_id: audience.registrationId }
  }

  const body = {
    platform: ['android', 'ios'],
    audience: audienceField,
    notification: {
      android: {
        title,
        alert: content,
        extras,
        // ⬇️ HMS 离线通道点击启动 App 的 intent（格式必须符合 Android intent URI 规范）
        // 只用 component，去掉 action/category，HMS 服务端校验更宽松
        intent: {
          url: 'intent:#Intent;component=com.junxin.petpogo_and/.MainActivity;end',
        },
      },
      ios: {
        alert: { title, body: content },
        extras,
        sound: 'default',
        badge: '+1',
      },
    },
    // 透传消息（App 在前台时使用）
    message: {
      msg_content: content,
      title,
      extras,
    },
    options: {
      time_to_live: timeToLive,
      apns_production: false,   // 先用开发环境，上线后改为 true
    },
  }

  const res = await fetch(JPUSH_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': AUTH_HEADER,
    },
    body: JSON.stringify(body),
  })

  const data: any = await res.json()

  if (!res.ok) {
    const errMsg = data?.error?.message ?? JSON.stringify(data)
    console.error('[JPush] 推送失败:', errMsg)

    // 找不到 alias / 用户未注册极光 → 返回 404，避免触发 500
    if (errMsg.includes('cannot find user') || errMsg.includes('inactive')) {
      throw createError({ statusCode: 404, message: `推送目标不存在或未注册（${errMsg}）` })
    }

    throw new Error(`JPush 推送失败: ${errMsg}`)
  }

  console.log(`[JPush] 推送成功 msg_id=${data.msg_id}`)
  return data as PushResult
}

// ── 快捷方法：给单个用户推（alias = userId）────────────────────────────────
export function jpushToUser(
  userId: string | number,
  title: string,
  content: string,
  extras?: Record<string, string>,
) {
  return jpushSend({
    audience: { type: 'alias', alias: [String(userId)] },
    title,
    content,
    extras,
  })
}

// ── 快捷方法：全体广播 ───────────────────────────────────────────────────────
export function jpushBroadcast(
  title: string,
  content: string,
  extras?: Record<string, string>,
) {
  return jpushSend({
    audience: { type: 'all' },
    title,
    content,
    extras,
  })
}

// ── 快捷方法：给指定设备的用户推送（点击后跳转到设备页）───────────────────
// extras 自动注入 device_mac，App 端收到通知后按 mac 打开对应设备界面
// userId: 用户 alias（手机号+@qq.com）
// deviceMac: 设备的 MAC 地址字符串（即 device_id）
export function jpushToDevice(
  userId: string | number,
  deviceMac: string,
  title: string,
  content: string,
  extraData?: Record<string, string>,
) {
  return jpushSend({
    audience: { type: 'alias', alias: [String(userId)] },
    title,
    content,
    extras: {
      device_mac: deviceMac,   // App 端读取此字段跳转 /device/:mac
      type: 'device',
      ...extraData,
    },
  })
}
