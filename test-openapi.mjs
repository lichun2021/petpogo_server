/**
 * 测试 POST /openapi/pet-circle/post
 * 签名规则：md5(apiKey + timestamp + apiSecret)
 */

import crypto from 'node:crypto'

const BASE_URL   = 'http://115.29.196.61:3000'
const API_KEY    = 'ce96786dcc394fddeb521d0e'
const API_SECRET = 'bec1adf7ad77c6e38d3a7599926d9b4203b3ff34f797c2cf'

function makeHeaders() {
  const ts = Date.now().toString()
  const sig = crypto.createHash('md5').update(`${API_KEY}${ts}${API_SECRET}`).digest('hex')
  return {
    'Content-Type': 'application/json',
    'x-api-key':   API_KEY,
    'x-timestamp': ts,
    'x-signature': sig,
  }
}

async function postPetCircle(body) {
  const res = await fetch(`${BASE_URL}/openapi/pet-circle/post`, {
    method: 'POST',
    headers: makeHeaders(),
    body: JSON.stringify(body),
  })
  const json = await res.json()
  return { status: res.status, body: json }
}

// ── 真实宠物数据 ─────────────────────────────────────────────────
const PET_ID    = '1219527580735262720'
const OWNER_UID = '44162677806080'   // 第一个真实用户 18616717926
const TODAY     = '2026-06-26'

const cases = [
  {
    label: 'A 今日运动日报（文字）',
    data: {
      petId:       PET_ID,
      ownerUserId: OWNER_UID,
      petName:     '萌宠',
      content:     `🐾 ${TODAY} 运动日报\n今天跑了 2.8 公里，活动时长 38 分钟，步数约 4100 步。状态超棒，保持下去！`,
      eventType:   'ai_daily',
      sourceId:    `daily-${TODAY}-${PET_ID}`,
      sourceTime:  `${TODAY}T08:00:00+08:00`,
    },
  },
  {
    label: 'B 自动抓拍（图片）',
    data: {
      petId:       PET_ID,
      ownerUserId: OWNER_UID,
      petName:     '萌宠',
      content:     '📸 设备自动抓拍：宠宝在阳光下休息，看起来心情不错～',
      mediaType:   'image',
      mediaUrls:   [
        'https://petpogo-oss.oss-cn-hangzhou.aliyuncs.com/demo/capture1.jpg',
        'https://petpogo-oss.oss-cn-hangzhou.aliyuncs.com/demo/capture2.jpg',
      ],
      coverUrl:    'https://petpogo-oss.oss-cn-hangzhou.aliyuncs.com/demo/capture1.jpg',
      eventType:   'capture',
      sourceId:    `capture-${TODAY}-001-${PET_ID}`,
      sourceTime:  `${TODAY}T10:15:00+08:00`,
    },
  },
  {
    label: 'C 健康提醒（文字）',
    data: {
      petId:       PET_ID,
      ownerUserId: OWNER_UID,
      petName:     '萌宠',
      content:     '💊 健康提醒：今日饮水量偏少，建议多补充水分。温度较高，注意防暑哦！',
      eventType:   'ai_health',
      sourceId:    `health-${TODAY}-${PET_ID}`,
      sourceTime:  `${TODAY}T12:00:00+08:00`,
    },
  },
  {
    label: 'D 趣味打招呼视频',
    data: {
      petId:       PET_ID,
      ownerUserId: OWNER_UID,
      petName:     '萌宠',
      content:     '🎬 宠宝向你打招呼啦！今天它特别活泼，蹦蹦跳跳停不下来～',
      mediaType:   'video',
      mediaUrls:   ['https://petpogo-oss.oss-cn-hangzhou.aliyuncs.com/demo/greeting.mp4'],
      coverUrl:    'https://petpogo-oss.oss-cn-hangzhou.aliyuncs.com/demo/greeting-cover.jpg',
      eventType:   'greeting',
      sourceId:    `greeting-${TODAY}-${PET_ID}`,
      sourceTime:  `${TODAY}T09:30:00+08:00`,
    },
  },
  {
    label: 'E 周报 AI 摘要（文字）',
    data: {
      petId:       PET_ID,
      ownerUserId: OWNER_UID,
      petName:     '萌宠',
      content:     `📊 本周运动周报（截至 ${TODAY}）\n✅ 累计运动 6 天\n🏃 总里程 16.3 公里\n⏱ 总时长 4.2 小时\n🔥 平均每日活动指数：优秀\n继续保持，宠宝越来越健康啦！`,
      eventType:   'ai_weekly',
      sourceId:    `weekly-2026-W26-${PET_ID}`,
      sourceTime:  `${TODAY}T07:00:00+08:00`,
    },
  },
]

// ── 执行 ────────────────────────────────────────────────────────
console.log(`\n🚀  写入真实数据 petId=${PET_ID}\n${'─'.repeat(60)}`)

for (const tc of cases) {
  try {
    const result = await postPetCircle(tc.data)
    const icon = result.status >= 400 ? '❌' : '✅'
    console.log(`${icon} ${tc.label}`)
    console.log(`   status: ${result.status}  body: ${JSON.stringify(result.body)}`)
  } catch (e) {
    console.log(`💥 ${tc.label}  →  网络错误: ${e.message}`)
  }
}

console.log('\n✨ 完成！验证 feed 接口:')
console.log(`   GET /sdkapi/pet-circle/feed?petId=${PET_ID}&page=1&pageSize=20\n`)
