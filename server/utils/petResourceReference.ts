import { createError } from 'h3'

/** 动作允许删除；旧表单和历史记录的失效引用统一按“未映射”处理。 */
export async function resolveGlbActionId(value: unknown): Promise<string | null> {
  if (value == null || value === '' || value === 0 || value === '0') return null
  if ((typeof value !== 'string' && typeof value !== 'number') ||
      (typeof value === 'number' && !Number.isSafeInteger(value)) ||
      !/^[1-9]\d{0,18}$/.test(String(value)) || BigInt(value) > 9223372036854775807n) {
    throw createError({ statusCode: 400, message: '动作映射 ID 格式无效', cause: { code: 'INVALID_GLB_ACTION_ID' } })
  }
  const [[row]]: any = await useDb().query(
    'SELECT id FROM t_pet_glb_action WHERE id=? AND deleted=0 LIMIT 1', [String(value)]
  )
  return row ? String(row.id) : null
}
