// 获取电子宠物资源清单：一次性返回当前可用的背景/形象/GLB动作标识/互动类型
// App 端渲染可选项 + 互动按钮动画使用。
// 注：glbActions 只是动作标识码列表（对应模型内置动画片段名），不含文件；
// interactionTypes 的 clipCode 供 App 在当前加载的形象模型里查找同名动画片段播放。
export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const db = useDb()

  const [backgrounds]: any = await db.query(
    'SELECT id, name, image_url FROM t_pet_background WHERE deleted=0 AND enabled=1 ORDER BY created_at DESC'
  )
  const [models]: any = await db.query(
    'SELECT id, name, glb_url, thumbnail_url FROM t_pet_model WHERE deleted=0 AND enabled=1 ORDER BY created_at DESC'
  )
  const [glbActions]: any = await db.query(
    'SELECT id, code, name FROM t_pet_glb_action WHERE deleted=0 AND enabled=1 ORDER BY created_at DESC'
  )
  const [interactionTypes]: any = await db.query(
    `SELECT it.id, it.code, it.name, it.icon_url, it.satiety_delta, it.mood_delta, it.cleanliness_delta, ga.code AS clip_code
       FROM t_pet_interaction_type it
       LEFT JOIN t_pet_glb_action ga ON ga.id = it.glb_action_id AND ga.deleted=0 AND ga.enabled=1
      WHERE it.deleted=0 AND it.enabled=1
      ORDER BY it.created_at ASC`
  )

  return {
    backgrounds: backgrounds.map((b: any) => ({ ...b, id: String(b.id) })),
    models: models.map((m: any) => ({ ...m, id: String(m.id) })),
    glbActions: glbActions.map((g: any) => ({ ...g, id: String(g.id) })),
    interactionTypes: interactionTypes.map((it: any) => ({
      ...it,
      id: String(it.id),
      clipCode: it.clip_code || null,
      clip_code: undefined,
    })),
  }
})
