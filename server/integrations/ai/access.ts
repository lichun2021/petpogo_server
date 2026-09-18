import { createError } from 'h3'
import { peerRequest, phoneToAccount } from '../../utils/peerBackend.ts'

// 只用于读取资源归属信息。跳过完整字符串 token，将超长整数转字符串再解析。
// 不修改对 App 返回的 JSON，也不把字符串里的数字当作 JSON 数值。
export function parseResourceJson(text: string): any {
  return JSON.parse(text.replace(/"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g, token => {
    if (/^-?\d+$/.test(token) && !Number.isSafeInteger(Number(token))) return JSON.stringify(token)
    return token
  }))
}

async function peerInfo(path: string, token: string, params: Record<string, string | number> = {}, method: 'GET' | 'POST' = 'POST') {
  const response = await peerRequest(path, { method, encoding: method === 'GET' ? 'query' : 'form', params, token })
  const data = parseResourceJson(response.body)
  if (response.status >= 400 || !data || Number(data.code) !== 0) {
    throw createError({ statusCode: 502, message: '暂时无法确认 Peer 资源权限，请稍后重试' })
  }
  return data
}

export async function assertAiDeviceAccess(token: string, mac: string) {
  const data = await peerInfo('/user/device/list', token)
  const devices = Array.isArray(data.info) ? data.info : data.list
  if (!Array.isArray(devices)) throw createError({ statusCode: 502, message: 'Peer 设备列表格式异常' })
  if (!devices.some(device => String(device.mac) === mac)) {
    throw createError({ statusCode: 403, message: '无权访问该设备' })
  }
}

export async function assertAiPetAccess(token: string, petId: string, phone: string) {
  const own = await peerInfo('/pet/info/list', token)
  const pets = Array.isArray(own.info) ? own.info : own.list
  if (!Array.isArray(pets)) throw createError({ statusCode: 502, message: 'Peer 宠物列表格式异常' })
  if (pets.some(pet => String(pet.petId) === petId)) return
  // 共享邀请列表不等于已接受的成员权限，使用成员信息校验当前账号。
  const shared = await peerInfo('/pet/share/members', token, { petId })
  const members = shared.info?.members
  const owner = shared.info?.owner
  if (!Array.isArray(members)) throw createError({ statusCode: 403, message: '无法确认宠物共享权限' })
  const account = phoneToAccount(phone)
  if (![owner, ...members].some(member => member && member.account === account)) {
    throw createError({ statusCode: 403, message: '无权访问该宠物' })
  }
}
