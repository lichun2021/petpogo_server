import assert from 'node:assert/strict'
import { test, before, after } from 'node:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { createError } from 'h3'

let temp, modules, body, queries, exists, failCleanup, transaction
before(async () => {
  temp = await mkdtemp(join(tmpdir(), 'admin-pet-reference-'))
  const output = join(temp, 'routes.cjs')
  const entries = {
    editInteraction: 'pet-interaction-types/[id].put', createInteraction: 'pet-interaction-types/create.post',
    editHardware: 'pet-hardware-actions/[id].put', createHardware: 'pet-hardware-actions/create.post',
    deleteAction: 'pet-glb-actions/[id].delete',
  }
  Object.assign(globalThis, {
    defineEventHandler: fn => fn, createError, getRouterParam: () => '2', readBody: async () => body,
    generateId: () => '123456789',
    useDb: () => ({ query, getConnection: async () => ({ query,
      beginTransaction: async () => transaction.push('begin'), commit: async () => transaction.push('commit'),
      rollback: async () => transaction.push('rollback'), release: () => transaction.push('release'),
    }) }),
  })
  await build({ stdin: { contents: Object.entries(entries).map(([name, file]) => `export { default as ${name} } from './server/routes/api/admin/${file}.ts';`).join('\n'), resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', outfile: output, logLevel: 'silent' })
  modules = (await import(pathToFileURL(output))).default
})
after(async () => { await rm(temp, { recursive: true, force: true }) })
async function query(sql, params) {
  queries.push({ sql, params })
  if (sql.startsWith('SELECT id FROM t_pet_glb_action')) return [exists ? [{ id: params[0] }] : []]
  if (sql.includes('WHERE code=')) return [[]]
  if (sql.startsWith('SELECT')) return [[{ id: '2' }]]
  if (failCleanup && sql.startsWith('UPDATE t_pet_hardware_action_type')) throw new Error('mock database failure')
  return [{ affectedRows: 1 }]
}
function reset() { body = { code: 'play', name: '逗猫', glb_action_id: '7' }; queries = []; exists = false; failCleanup = false; transaction = [] }

for (const route of ['editInteraction', 'createInteraction', 'editHardware', 'createHardware']) {
  test(`${route}：已删除/不存在引用和空映射可正常保存，有效长 ID 保持精度`, async () => {
    for (const value of ['7', null, '', 0, '0', '1234647089750028288']) {
      reset(); body.glb_action_id = value; exists = value === '1234647089750028288'
      assert.equal((await modules[route]({})).success, true)
      const write = queries.find(q => /^(UPDATE|INSERT)/.test(q.sql))
      const refIndex = route.startsWith('create') ? 4 : 2
      assert.equal(write.params[refIndex], exists ? value : null)
    }
  })
}

test('仍拒绝空名称和不合法 ID，不删除必要的输入校验', async () => {
  reset(); body.name = ''
  await assert.rejects(modules.editInteraction({}), e => e.statusCode === 400)
  assert.equal(queries.length, 0)
  reset(); body.glb_action_id = ['7']
  await assert.rejects(modules.editHardware({}), e => e.statusCode === 400)
  assert.ok(!queries.some(q => q.sql.startsWith('UPDATE')))
})

test('删除 GLB 动作时同一事务清理两种引用；任一步失败回滚', async () => {
  reset()
  assert.equal((await modules.deleteAction({})).success, true)
  assert.deepEqual(transaction, ['begin', 'commit', 'release'])
  assert.equal(queries.length, 3)
  for (const q of queries.slice(1)) assert.ok(q.sql.includes('SET glb_action_id=NULL'))
  reset(); failCleanup = true
  await assert.rejects(modules.deleteAction({}))
  assert.deepEqual(transaction, ['begin', 'rollback', 'release'])
})
