// 使用内存数据库替身验证事务、默认保护和资料编辑，不访问真实服务。
import assert from 'node:assert/strict'
import { test, before, after } from 'node:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { createError } from 'h3'
let temp, routes, body, queries, tx, sequence = 100
const model = { id: '2', name: '默认猫', glb_url: '/cat.glb', thumbnail_url: null, enabled: 1, deleted: 0 }
const connection = {
  beginTransaction: async () => tx.push('begin'), commit: async () => tx.push('commit'), rollback: async () => tx.push('rollback'), release: () => tx.push('release'),
  async query(sql, params = []) {
    queries.push({ sql, params })
    assert.equal((sql.match(/\?/g) || []).length, params.length)
    if (sql.startsWith('SELECT * FROM t_pet_model_assignment')) return [[{ default_model_id: '2', rules: [], breed_mappings: [] }]]
    if (sql.startsWith('SELECT') && sql.includes('FROM t_pet_model')) return [[model]]
    if (sql.startsWith('SELECT') && sql.includes('FROM t_pet')) return [[{ id: '2' }]]
    return [{ affectedRows: 1 }]
  },
}
before(async () => {
  temp = await mkdtemp(join(tmpdir(), 'pet-model-api-'))
  const output = join(temp, 'routes.cjs')
  await build({ stdin: { contents: `export * as utils from './server/utils/petModelAssignment.ts';
    export { default as saveConfig } from './server/routes/api/admin/pet-model-assignment/index.put.ts';
    export { default as deleteModel } from './server/routes/api/admin/pet-models/[id].delete.ts';
    export { default as editModel } from './server/routes/api/admin/pet-models/[id].put.ts';
    export { default as editPet } from './server/routes/sdkapi/pet/[id].put.ts';
    export { default as adminPet } from './server/routes/api/admin/pets/[id].put.ts';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', outfile: output, logLevel: 'silent' })
  Object.assign(globalThis, { defineEventHandler: fn => fn, createError, getRouterParam: () => '2', readBody: async () => body,
    useDb: () => ({ query: connection.query, getConnection: async () => connection }), requireAuth: async () => ({ userId: '1' }), generateId: () => String(++sequence) })
  routes = (await import(pathToFileURL(output))).default
  Object.assign(globalThis, routes.utils)
})
after(async () => rm(temp, { recursive: true, force: true }))
function reset(value) { body = value; queries = []; tx = [] }
test('默认形象不能停用或删除，回滚并释放连接', async () => {
  for (const route of ['deleteModel', 'editModel']) {
    reset({ name: '默认猫', glb_url: '/cat.glb', enabled: 0 })
    await assert.rejects(routes[route]({}), e => e.statusCode === 400)
    assert.ok(!queries.some(q => q.sql.startsWith('UPDATE')))
    assert.deepEqual(tx, ['begin', 'rollback', 'release'])
  }
})
test('资料保存未传、传空 modelId 均保留形象；明确选择才保存快照', async () => {
  for (const modelId of [undefined, null, '', '2']) {
    reset({ name: '小猫', modelId })
    await routes.editPet({})
    assert.deepEqual(tx, ['begin', 'commit', 'release'])
    const snapshot = queries.find(q => q.sql.startsWith('UPDATE t_pet SET model_id='))
    assert.equal(Boolean(snapshot), modelId === '2')
    if (snapshot) { assert.equal(JSON.parse(snapshot.params[1]).glb_url, '/cat.glb'); assert.equal(snapshot.params[2], 'manual') }
    const profile = queries.find(q => q.sql.includes('SET name='))
    assert.ok(!profile.sql.includes('model_id='))
  }
})
test('后台重新匹配和手动指定与资料同事务提交', async () => {
  for (const assignmentMode of ['keep', 'rematch', 'manual']) {
    reset({ name: '小猫', species: 'cat', assignmentMode, modelId: '2' })
    await routes.adminPet({})
    assert.deepEqual(tx, ['begin', 'commit', 'release'])
    const snapshot = queries.find(q => q.sql.startsWith('UPDATE t_pet SET model_id='))
    assert.equal(Boolean(snapshot), assignmentMode !== 'keep')
    if (snapshot) assert.equal(snapshot.params[2], assignmentMode === 'manual' ? 'manual' : 'default')
  }
})
test('配置拒绝无效优先级、重复 ID、重复品种映射和不存在的保底', async () => {
  const r = { id: '10', name: '猫', modelId: '2', species: 'cat', gender: null, breeds: [], priority: 1, enabled: 1 }
  for (const override of [{ rules: [{ ...r, priority: 1.5 }] }, { rules: [r,r] }, { breedMappings: [{ breed: 'Cat', species: 'cat' }, { breed: ' cat ', species: 'dog' }] }, { defaultModelId: '999' }]) {
    reset({ defaultModelId: '2', rules: [r], breedMappings: [], ...override })
    await assert.rejects(routes.saveConfig({}), e => e.statusCode === 400)
    assert.ok(!queries.some(q => q.sql.startsWith('UPDATE')))
  }
})
test('有效配置原子保存，品种规范化，新规则取得稳定 ID', async () => {
  reset({ defaultModelId: '2', rules: [{ name: '猫', modelId: '2', species: 'cat', gender: null, breeds: [' Ragdoll '], priority: 1, enabled: 1 }], breedMappings: [] })
  await routes.saveConfig({})
  const write = queries.find(q => q.sql.startsWith('UPDATE'))
  const rules = JSON.parse(write.params[1])
  assert.deepEqual(rules[0].breeds, ['ragdoll']); assert.match(rules[0].id, /^\d+$/)
  assert.deepEqual(tx, ['begin','commit','release'])
})
