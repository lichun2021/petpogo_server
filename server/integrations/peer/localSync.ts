import { createError } from 'h3'
import type { PoolConnection } from 'mysql2/promise'
import { peerRequest } from '../../utils/peerBackend.ts'
import { parseResourceJson } from '../shared/json.ts'

const paths = new Set(['/user/device/bind', '/user/device/unbind', '/pet/info/add', '/pet/info/del'])
type Params = Record<string, string | number>
const invalid = () => createError({ statusCode: 502, message: 'Peer 同步数据不完整或与本地记录冲突' })
function id(value: unknown): string {
  const text = String(value ?? '')
  if (!/^[1-9]\d{0,18}$/.test(text) || BigInt(text) > 9223372036854775807n) throw invalid()
  return text
}
const deviceId = (value: unknown) => value == null || value === '' || String(value) === '0' ? null : id(value)
function text(value: unknown, max: number, required = false): string | null {
  if (value == null || value === '') { if (required) throw invalid(); return null }
  if (typeof value !== 'string' || value.length > max) throw invalid()
  return value
}
async function readPeer(path: string, token: string, params: Params, requestId?: string) {
  const response = await peerRequest(path, { method: 'POST', encoding: 'form', params, token, requestId })
  const data = parseResourceJson(response.body)
  if (response.status < 200 || response.status >= 300 || String(data?.code) !== '0') throw invalid()
  return data
}
function list(data: any): any[] {
  const items = Array.isArray(data.info) ? data.info : data.list
  if (!Array.isArray(items)) throw invalid()
  return items
}

async function saveDevice(db: PoolConnection, userId: string, value: any, owner?: boolean) {
  const peerId = id(value.deviceId ?? value.id), mac = text(value.mac, 50, true)!
  // mac 和 Peer ID 必须指向同一条记录，禁止冲突时覆盖其他设备。
  await db.query('INSERT INTO t_device(id,mac,name,created_at) VALUES(?,?,?,NOW()) ON DUPLICATE KEY UPDATE id=id',
    [peerId, mac, text(value.name ?? value.deviceNickname ?? value.deviceNickName, 100)])
  const [[device]]: any = await db.query('SELECT id,mac FROM t_device WHERE id=? OR mac=? FOR UPDATE', [peerId, mac])
  if (!device || String(device.id) !== peerId || device.mac !== mac) throw invalid()
  await db.query(`UPDATE t_device SET name=COALESCE(?,name),product_id=COALESCE(?,product_id),
    merchant_id=COALESCE(?,merchant_id),online_status=COALESCE(?,online_status),deleted=0 WHERE id=?`,
  [text(value.name, 100), deviceId(value.productId), deviceId(value.merchantId),
    typeof value.onlineStatus === 'boolean' ? value.onlineStatus : typeof value.connect === 'boolean' ? value.connect : null, peerId])
  await db.query(`INSERT INTO t_user_device(id,user_id,device_id,mac,nickname,u_type,created_at)
    VALUES(?,?,?,?,?,?,NOW()) ON DUPLICATE KEY UPDATE nickname=VALUES(nickname),u_type=VALUES(u_type)`,
  [String(generateId()), userId, peerId, mac, text(value.deviceNickname ?? value.deviceNickName, 100) || mac,
    owner === true || String(value.uType) === '1' ? 'owner' : 'shared'])
}

async function savePet(db: PoolConnection, userId: string, value: any, modelId: string | null) {
  const petId = id(value.petId), name = text(value.petName, 50, true)
  // age 与生日、weight 与本地体重的单位未形成契约，不做猜测转换。
  const sex = String(value.sex ?? '')
  const gender = sex.startsWith('GG') ? 1 : sex.startsWith('MM') ? 2 : 0
  // 重复同步不重置形象、背景、养成值及本地独有的生日/简介。
  await db.query(`INSERT INTO t_pet(id,user_id,name,avatar,species,breed,gender,device_id,model_id,
    satiety,mood,cleanliness,stats_updated_at,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,100,100,100,NOW(),NOW()) ON DUPLICATE KEY UPDATE id=id`,
  [petId, userId, name, text(value.avatar, 500), 'other', text(value.breed, 100), gender, deviceId(value.deviceId), modelId])
  const [[existing]]: any = await db.query('SELECT user_id FROM t_pet WHERE id=? FOR UPDATE', [petId])
  if (!existing || String(existing.user_id) !== userId) throw invalid()
  await db.query(`UPDATE t_pet SET name=?,avatar=?,breed=?,gender=?,device_id=?,deleted=0,updated_at=NOW()
    WHERE id=? AND user_id=?`,
  [name, text(value.avatar, 500), text(value.breed, 100), gender, deviceId(value.deviceId), petId, userId])
}

/** 仅在上游写操作成功后同步；查询上游不持有数据库事务，不自动重放写操作。 */
export async function syncPeerMutation(input: {
  path: string; params: Params; body: string; status: number; userId: string; token: string; requestId?: string
}): Promise<boolean> {
  const { path, params, status, userId, token, requestId } = input
  if (!paths.has(path) || status < 200 || status >= 300) return false
  const response = parseResourceJson(input.body)
  if (String(response?.code) !== '0') return false
  let pets: any[] = [], devices: any[] = []
  if (path === '/user/device/bind') {
    const value = response.info?.deviceId && response.info?.mac ? response.info
      : (await readPeer('/user/device/detail', token, { mac: params.mac }, requestId)).info
    if (!value || value.mac !== String(params.mac)) throw invalid()
    devices = [{ ...value, deviceNickname: params.deviceNickName ?? value.deviceNickname ?? value.deviceNickName }]
  }
  if (path === '/pet/info/add') {
    if (response.info?.petId) pets = [{ ...params, ...response.info }]
    else if (params.mac || params.deviceId) {
      const selector: Params = params.mac ? { mac: params.mac } : { deviceId: params.deviceId }
      const data = await readPeer('/pet/info/get', token, selector, requestId)
      if (!data.info?.petId) throw invalid()
      pets = [{ ...params, ...data.info }]
    } else {
      // 无设备宠物的 add 可能只返回成功码；读取本人列表取得真实 ID，绝不按名字猜 ID。
      pets = list(await readPeer('/pet/info/list', token, {}, requestId))
      if (!pets.length) throw invalid()
    }
    const ids = new Set(pets.map(p => deviceId(p.deviceId)).filter(Boolean))
    if (ids.size) {
      devices = list(await readPeer('/user/device/list', token, {}, requestId)).filter(d => ids.has(String(d.deviceId)))
      if (devices.length !== ids.size) throw invalid()
    }
  }
  const db = await useDb().getConnection()
  try {
    await db.beginTransaction()
    for (const device of devices) await saveDevice(db, userId, device, path === '/user/device/bind')
    if (pets.length) {
      const [[model]]: any = await db.query('SELECT id FROM t_pet_model WHERE deleted=0 AND enabled=1 ORDER BY created_at ASC LIMIT 1')
      for (const pet of pets) await savePet(db, userId, pet, model ? String(model.id) : null)
    }
    if (path === '/user/device/unbind') {
      // 解绑不删除硬件，也不删除宠物；仅解除当前用户关系及其宠物的设备关联。
      await db.query(`UPDATE t_pet p JOIN t_device d ON p.device_id=d.id
        SET p.device_id=NULL,p.updated_at=NOW() WHERE p.user_id=? AND d.mac=?`, [userId, params.mac])
      await db.query('DELETE FROM t_user_device WHERE user_id=? AND mac=?', [userId, params.mac])
    }
    if (path === '/pet/info/del') {
      // Peer petId 优先；缺省时按 deviceId 删除，始终限制为当前用户。
      const column = params.petId ? 'id' : 'device_id'
      await db.query(`UPDATE t_pet SET deleted=1,updated_at=NOW() WHERE user_id=? AND ${column}=?`,
        [userId, id(params.petId || params.deviceId)])
    }
    await db.commit()
    return true
  } catch (error) {
    await db.rollback()
    throw error
  } finally { db.release() }
}
