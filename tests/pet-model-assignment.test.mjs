import assert from 'node:assert/strict'
import { test, before, after } from 'node:test'
import { build } from 'esbuild'
import { mkdtemp,rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
let matchPetModel,ensurePetModelSnapshot,temp
before(async()=>{temp=await mkdtemp(join(tmpdir(),'pet-match-'));await build({entryPoints:['server/utils/petModelAssignment.ts'],bundle:true,platform:'node',format:'cjs',outfile:join(temp,'match.cjs'),logLevel:'silent'});({matchPetModel,ensurePetModelSnapshot}=(await import(join(temp,'match.cjs'))).default)})
after(async()=>rm(temp,{recursive:true,force:true}))
const models = [
  { id: '1234647089750028288', name: '保底', glb_url: '/default.glb', enabled: 1 },
  { id: '2', name: '布偶', glb_url: '/ragdoll.glb', enabled: 1 },
  { id: '3', name: '停用', glb_url: '/off.glb', enabled: 0 },
]
const rule = (changes = {}) => ({ id: '10', name: '布偶规则', modelId: '2', species: 'cat', breeds: ['布偶', 'ragdoll'], gender: null, priority: 100, enabled: 1, ...changes })
const config = (rules = [rule()]) => ({ defaultModelId: models[0].id, defaultCatModelId: models[0].id, defaultDogModelId: models[0].id, breedMappings: [{ breed: '布偶', species: 'cat' }, { breed: 'ragdoll', species: 'cat' }], rules })
test('品种映射、别名、大小写空格、未知性别均按同一规则匹配', () => {
  for (const breed of ['布偶', ' Ragdoll ']) {
    const result = matchPetModel(config(), models, { breed })
    assert.equal(result.model.id, '2'); assert.equal(result.species, 'cat'); assert.equal(result.source, 'rule')
  }
})
test('条件是且关系，缺失或不符条件走保底，长 ID 不丢精度', () => {
  for (const pet of [{}, { species: 'dog', breed: '布偶' }, { breed: '未知品种' }, { breed: '布偶', gender: 2 }]) {
    const result = matchPetModel(config([rule({ gender: 1 })]), models, pet)
    assert.equal(result.model.id, '1234647089750028288'); assert.equal(result.source, 'default')
  }
})
test('高优先级先匹配，同优先级不受数组顺序影响', () => {
  const a = rule({ id: '11', modelId: models[0].id }), b = rule()
  assert.equal(matchPetModel(config([a,b]), models, { breed: '布偶' }).ruleId, '10')
  assert.equal(matchPetModel(config([b,a]), models, { breed: '布偶' }).ruleId, '10')
  assert.equal(matchPetModel(config([rule({ priority: 101, id: '12' }), b]), models, { breed: '布偶' }).ruleId, '12')
})
test('停用规则、停用或删除模型被跳过，继续匹配低优先级规则', () => {
  for (const r of [rule({ enabled: 0 }), rule({ modelId: '3' }), rule({ modelId: '999' })]) {
    const result = matchPetModel(config([r, rule({ id: '20', priority: 1, species: 'all', breeds: [] })]), models, { breed: '布偶' })
    assert.equal(result.ruleId, '20')
  }
})
test('没有有效保底明确报错，快照不随资源后续修改变化', () => {
  assert.throws(() => matchPetModel({ ...config([]), defaultModelId: '3' }, models, {}), e => e.statusCode === 503)
  const copy = structuredClone(models), result = matchPetModel(config(), copy, { breed: '布偶' })
  copy[1].glb_url = '/new.glb'
  assert.equal(result.model.glb_url, '/ragdoll.glb')
})

test('历史空模型按默认分配并保存快照，后续读取不重配', async () => {
  const pet = { id: '100', species: null, breed: null, gender: 0, model_id: null, model_snapshot: null }
  let writes = 0
  const db = { query: async (sql, params) => {
    if (sql.includes('FROM t_pet WHERE')) return [[{ ...pet }]]
    if (sql.includes('FROM t_pet_model_assignment')) return [[{ default_model_id: models[0].id, rules: [], breed_mappings: [] }]]
    if (sql.includes('FROM t_pet_model')) return [models]
    if (sql.startsWith('UPDATE t_pet SET model_id=')) {
      writes++; Object.assign(pet, {model_id:params[0],model_snapshot:params[1],model_assignment_source:params[2],model_rule_name:params[3]})
      return [{affectedRows:1}]
    }
    throw new Error(sql)
  }}
  const result = await ensurePetModelSnapshot(db, '100', '200')
  assert.equal(JSON.parse(result.model_snapshot).id, models[0].id)
  assert.equal(result.model_assignment_source, 'default')
  await ensurePetModelSnapshot(db, '100', '200')
  assert.equal(writes, 1)
})
test('持锁复核保留并发写入的快照；他人宠物不分配', async () => {
  const snapshot = { model_snapshot: {id:'manual',glb_url:'/manual.glb'}, model_assignment_source:'manual' }
  assert.equal(await ensurePetModelSnapshot({query:async()=>[[snapshot]]},'1','2'),snapshot)
  await assert.rejects(ensurePetModelSnapshot({query:async()=>[[]]},'1','2'),e=>e.statusCode===404)
})
