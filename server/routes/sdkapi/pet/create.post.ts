// 创建宠物档案
// id 由调用方传入（如与对方iPet硬件后台的宠物ID保持一致），不再由服务端生成
// 形象由系统自动分配，不接受客户端指定：取当前启用且未删除、创建最早的一条；
// 目前资源库仅一条，规则同样适用于以后新增更多形象
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const { id, name, avatar, species, breed, gender, birthday, weight, bio, deviceId } = await readBody(event)
  if (!id) throw createError({ statusCode: 400, message: '缺少宠物ID' })
  if (!name) throw createError({ statusCode: 400, message: '宠物名称不能为空' })

  const db = useDb()
  const [[dup]]: any = await db.query('SELECT id FROM t_pet WHERE id=? LIMIT 1', [id])
  if (dup) throw createError({ statusCode: 400, message: '宠物ID已存在' })

  const [[defaultModel]]: any = await db.query(
    'SELECT id, glb_url FROM t_pet_model WHERE deleted=0 AND enabled=1 ORDER BY created_at ASC LIMIT 1'
  )
  const finalModel = defaultModel ? { id: String(defaultModel.id), glb_url: defaultModel.glb_url } : null

  await db.query(
    'INSERT INTO t_pet(id,user_id,name,avatar,species,breed,gender,birthday,weight,bio,device_id,model_id,satiety,mood,cleanliness,stats_updated_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,100,100,100,NOW(),NOW())',
    [id, user.userId, name, avatar || null, species || null, breed || null, gender ?? 0, birthday || null, weight || null, bio || null, deviceId || null, finalModel?.id || null]
  )
  return {
    id: String(id),
    name,
    modelId: finalModel?.id || null,
    modelGlbUrl: finalModel?.glb_url || null,
  }
})
