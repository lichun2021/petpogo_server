// GET /api/admin/pet-events — 宠物事件统一查询（互动触发 + 硬件动作上报）
// 支持按宠物ID/设备ID/来源类型/时间范围筛选，分页，最新在前
//
// Query 参数：
//   petId       String?  按宠物ID筛
//   deviceId    String?  按设备ID筛
//   source      String?  interaction / hardware_action
//   start_time  String?  开始时间
//   end_time    String?  结束时间
//   page        int      默认1
//   limit       int      默认20，最大100

const VALID_SOURCES = new Set(['interaction', 'hardware_action'])

export default defineEventHandler(async (event) => {
  const query     = getQuery(event)
  const petId     = (query.petId    as string) || ''
  const deviceId  = (query.deviceId as string) || ''
  const source    = (query.source   as string) || ''
  const startTime = (query.start_time as string) || ''
  const endTime   = (query.end_time  as string) || ''
  const page   = Math.max(1, Number(query.page)  || 1)
  const limit  = Math.min(100, Math.max(1, Number(query.limit) || 20))
  const offset = (page - 1) * limit

  const db = useDb()
  const conditions: string[] = []
  const params: any[] = []

  if (petId.trim())    { conditions.push('e.pet_id = ?');    params.push(petId.trim()) }
  if (deviceId.trim()) { conditions.push('e.device_id = ?'); params.push(deviceId.trim()) }
  if (source && VALID_SOURCES.has(source)) { conditions.push('e.source = ?'); params.push(source) }
  if (startTime) { conditions.push('e.occurred_at >= ?'); params.push(startTime) }
  if (endTime)   { conditions.push('e.occurred_at <= ?'); params.push(endTime) }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''

  const [[{ total }]]: any = await db.query(
    `SELECT COUNT(*) AS total FROM t_pet_event e ${where}`,
    params
  )

  const [rows]: any = await db.query(
    `SELECT e.id, e.source, e.pet_id, e.device_id, e.ref_type_id, e.occurred_at,
            p.name AS pet_name,
            CASE e.source
              WHEN 'interaction'     THEN it.name
              WHEN 'hardware_action' THEN h.name
            END AS type_name,
            CASE e.source
              WHEN 'interaction'     THEN it.code
              WHEN 'hardware_action' THEN h.code
            END AS type_code
       FROM t_pet_event e
       LEFT JOIN t_pet p ON p.id = e.pet_id
       LEFT JOIN t_pet_interaction_type it ON e.source = 'interaction' AND it.id = e.ref_type_id
       LEFT JOIN t_pet_hardware_action_type h ON e.source = 'hardware_action' AND h.id = e.ref_type_id
       ${where}
       ORDER BY e.occurred_at DESC
       LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  )

  return {
    list: rows.map((r: any) => ({
      ...r,
      id: String(r.id),
      pet_id: r.pet_id ? String(r.pet_id) : null,
      device_id: r.device_id ? String(r.device_id) : null,
      ref_type_id: String(r.ref_type_id),
    })),
    total: Number(total),
    page,
    limit,
  }
})
