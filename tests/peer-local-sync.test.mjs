// 本地事务模型验证，不连接真实 Peer/MySQL，不创建真实宠物或设备。
import assert from 'node:assert/strict'
import { test, before, after } from 'node:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

let sync, temp, state, snapshot, queries, upstream, calls, connections, commits, rollbacks, released, sequence = 0
const originalFetch = globalThis.fetch
const petId = '1234647089750028288', devId = '1234647089750028299'
const connection = {
  async beginTransaction() { snapshot = structuredClone(state) },
  async commit() { commits++ },
  async rollback() { state = snapshot; rollbacks++ },
  release() { released++ },
  async query(sql, params = []) {
    assert.equal((sql.match(/\?/g) ?? []).length, params.length, 'SQL 占位符与参数数量一致')
    sql = sql.replace(/\s+/g, ' ').trim(); queries.push({ sql, params })
    if (sql.startsWith('INSERT INTO t_device')) {
      if (!state.devices.some(d => d.id === params[0] || d.mac === params[1])) state.devices.push({ id: params[0], mac: params[1] })
    } else if (sql.startsWith('SELECT id,mac FROM t_device')) {
      return [state.devices.filter(d => d.id === params[0] || d.mac === params[1])]
    } else if (sql.startsWith('UPDATE t_device')) {
      state.devices.find(d => d.id === params[params.length - 1]).deleted = 0
    } else if (sql.startsWith('INSERT INTO t_user_device')) {
      const value = { user: params[1], device: params[2], mac: params[3], nickname: params[4], type: params[5] }
      const existing = state.links.find(d => d.user === value.user && d.device === value.device)
      if (existing) Object.assign(existing, value); else state.links.push(value)
    } else if (sql.startsWith('SELECT id FROM t_pet_model')) return [[{ id: '42' }]]
    else if (sql.startsWith('INSERT INTO t_pet(')) {
      if (!state.pets.some(p => p.id === params[0])) state.pets.push({ id: params[0], user_id: params[1], name: params[2], species: params[4], model: params[8], mood: 100 })
    } else if (sql.startsWith('SELECT user_id FROM t_pet')) return [state.pets.filter(p => p.id === params[0])]
    else if (sql.startsWith('UPDATE t_pet SET name=')) {
      const p = state.pets.find(p => p.id === params[5] && p.user_id === params[6])
      if (p) Object.assign(p, { name: params[0], avatar: params[1], breed: params[2], gender: params[3], device_id: params[4], deleted: 0 })
    } else if (sql.startsWith('UPDATE t_pet p JOIN')) {
      for (const p of state.pets) if (p.user_id === params[0] && state.devices.some(d => d.id === p.device_id && d.mac === params[1])) p.device_id = null
    } else if (sql.startsWith('DELETE FROM t_user_device')) state.links = state.links.filter(d => d.user !== params[0] || d.mac !== params[1])
    else if (sql.startsWith('UPDATE t_pet SET deleted=1')) {
      const field = sql.includes('AND device_id=') ? 'device_id' : 'id'
      for (const p of state.pets) if (p.user_id === params[0] && p[field] === params[1]) p.deleted = 1
    } else throw new Error(`Unexpected query: ${sql}`)
    return [{ affectedRows: 1 }]
  },
}
before(async () => {
  temp = await mkdtemp(join(tmpdir(), 'peer-sync-'))
  const output = join(temp, 'sync.cjs')
  await build({ entryPoints: ['server/integrations/peer/localSync.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: output, logLevel: 'silent' })
  sync = (await import(pathToFileURL(output))).default.syncPeerMutation
  Object.assign(globalThis, {
    useRuntimeConfig: () => ({ peerBackendUrl: 'https://peer.example.test', peerBackendTimeoutMs: 1000 }),
    useDb: () => ({ getConnection: async () => { connections++; return connection } }),
    generateId: () => String(++sequence),
    fetch: async (url, options) => {
      calls.push({ path: url.pathname, params: new URLSearchParams(options.body) })
      const value = upstream.shift(); assert.ok(value, '不允许未预期的上游调用')
      return new Response(typeof value === 'string' ? value : JSON.stringify(value), { status: 200 })
    },
  })
})
after(async () => { globalThis.fetch = originalFetch; await rm(temp, { recursive: true, force: true }) })
function reset() {
  state = { devices: [], links: [], pets: [] }; queries = []; upstream = []; calls = []
  connections = commits = rollbacks = released = 0
}
function invoke(path, params = {}, info, code = 0, status = 200) {
  return sync({ path, params, body: JSON.stringify({ code, info }), status, userId: '1', token: 'test-token' })
}

test('绑定设备参数对齐，重复绑定不重复建档；详情兼容 id/deviceNickName', async () => {
  reset()
  const detail = { id: devId, mac: 'AA', deviceNickName: '详情昵称' }
  upstream.push({ code: 0, info: detail }, { code: 0, info: detail })
  await invoke('/user/device/bind', { mac: 'AA', deviceNickName: '请求昵称' })
  await invoke('/user/device/bind', { mac: 'AA', deviceNickName: '请求昵称' })
  assert.equal(state.devices.length, 1); assert.equal(state.links.length, 1)
  assert.equal(state.devices[0].id, devId)
  assert.equal(state.links[0].nickname, '请求昵称'); assert.equal(state.links[0].type, 'owner')
  assert.equal(calls[0].path, '/user/device/detail'); assert.equal(commits, 2)
})

test('宠物字段映射和长 ID 完整；重复同步保留本地形象/养成/生日/体重', async () => {
  reset()
  const info = { petId, petName: '小狗', sex: 'MM_sterilization', age: 8, weight: '单位未确认', avatar: 'https://example.test/a' }
  await invoke('/pet/info/add', { petName: '小狗' }, info)
  assert.equal(state.pets[0].id, petId); assert.equal(state.pets[0].species, 'other')
  assert.equal(state.pets[0].model, '42')
  Object.assign(state.pets[0], { model: '99', mood: 65, birthday: '2020-01-01', weight: 4.5 })
  await invoke('/pet/info/add', { petName: '小狗' }, info)
  assert.equal(state.pets.length, 1)
  assert.equal(state.pets[0].gender, 2)
  assert.equal(state.pets[0].model, '99'); assert.equal(state.pets[0].mood, 65)
  assert.equal(state.pets[0].birthday, '2020-01-01'); assert.equal(state.pets[0].weight, 4.5)
  assert.ok(!queries.some(q => q.sql.includes('weight=')))
})

test('无宠物 ID 的新增响应，通过本人列表取得真实长整数 ID', async () => {
  reset()
  upstream.push(`{"code":0,"info":[{"petId":${petId},"petName":"小狗","sex":"GG"}]}`)
  await invoke('/pet/info/add', { petName: '小狗' })
  assert.equal(calls[0].path, '/pet/info/list'); assert.equal(state.pets[0].id, petId)
})

test('带设备新增宠物通过 get 补齐宠物，再同步关联设备', async () => {
  reset()
  upstream.push({ code: 0, info: { petId, petName: '小狗', deviceId: devId } },
    { code: 0, info: [{ deviceId: devId, mac: 'AA', deviceNickname: '设备昵称', uType: 1 }] })
  await invoke('/pet/info/add', { mac: 'AA', petName: '小狗' })
  assert.equal(calls[0].params.get('mac'), 'AA')
  assert.equal(state.pets[0].device_id, devId); assert.equal(state.links[0].nickname, '设备昵称')
})

test('删除宠物限定当前用户；设备解绑保留硬件和宠物，仅清理自己的关联', async () => {
  reset()
  state.devices.push({ id: devId, mac: 'AA' })
  state.links.push({ user: '1', mac: 'AA' }, { user: '2', mac: 'AA' })
  state.pets.push({ id: petId, user_id: '1', device_id: devId }, { id: '88', user_id: '2', device_id: devId })
  await invoke('/pet/info/del', { deviceId: devId })
  assert.equal(state.pets[0].deleted, 1); assert.equal(state.pets[1].deleted, undefined)
  await invoke('/user/device/unbind', { mac: 'AA' })
  assert.equal(state.devices.length, 1); assert.equal(state.pets[0].device_id, null)
  assert.equal(state.pets[1].device_id, devId); assert.equal(state.links.length, 1)
})

test('上游失败和非目标接口不读写本地、不发起额外请求', async () => {
  reset()
  assert.equal(await invoke('/pet/info/add', { petName: 'x' }, null, 17806), false)
  assert.equal(await invoke('/user/device/bind', { mac: 'AA' }, null, 0, 500), false)
  assert.equal(await invoke('/pet/info/update', { petId }), false)
  assert.equal(connections, 0); assert.equal(calls.length, 0)
})

test('跨用户宠物冲突和设备 ID/MAC 冲突回滚，释放连接', async () => {
  reset()
  state.pets.push({ id: petId, user_id: '2', name: '别人的宠物' })
  await assert.rejects(invoke('/pet/info/add', { petName: '小狗' }, { petId, petName: '小狗' }))
  assert.equal(state.pets[0].name, '别人的宠物'); assert.equal(rollbacks, 1); assert.equal(released, 1)
  state.devices.push({ id: '66', mac: 'AA' })
  await assert.rejects(invoke('/user/device/bind', { mac: 'AA' }, { deviceId: devId, mac: 'AA' }))
  assert.equal(state.links.length, 0); assert.equal(rollbacks, 2); assert.equal(released, 2)
})

test('缺少真实宠物 ID 不按名字猜测，也不产生本地记录', async () => {
  reset(); upstream.push({ code: 0, info: [] })
  await assert.rejects(invoke('/pet/info/add', { petName: '小狗' }))
  assert.equal(connections, 0)
})
