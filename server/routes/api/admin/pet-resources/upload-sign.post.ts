// POST /api/admin/pet-resources/upload-sign
// 电子宠物资源库上传专用预签名接口：背景图 / 形象GLB
// folder: 'pet-background' | 'pet-model'
// 注：GLB 动作是内嵌在形象模型文件里的动画片段（clip），不是独立文件，因此本接口不再提供
// pet-glb-action 目录；动作标识库（t_pet_glb_action）只登记片段名，不走此上传接口。
import OSS from 'ali-oss'
import crypto from 'node:crypto'

const MIME_EXT: Record<string, string> = {
  // 图片
  'image/jpeg':  'jpg',
  'image/jpg':   'jpg',
  'image/png':   'png',
  'image/webp':  'webp',
  // GLB 模型（浏览器上传 .glb 常报 application/octet-stream，靠 ext 参数兜底）
  'model/gltf-binary':      'glb',
  'application/octet-stream': 'glb',
}

const VALID_FOLDERS = new Set(['pet-background', 'pet-model'])

export default defineEventHandler(async (event) => {
  const {
    mimeType,
    ext,       // 可选：浏览器把 .glb 报成 application/octet-stream 时，前端显式传 'glb' 兜底
    folder = 'pet-model',
  } = await readBody(event)

  if (!mimeType) throw createError({ statusCode: 400, message: '缺少 mimeType' })
  if (!VALID_FOLDERS.has(folder)) throw createError({ statusCode: 400, message: `不支持的 folder: ${folder}` })

  const mime = (mimeType as string).toLowerCase()
  const resolvedExt = MIME_EXT[mime] || (ext ? String(ext).toLowerCase() : '')
  if (!resolvedExt) throw createError({ statusCode: 400, message: `不支持的文件类型: ${mimeType}` })

  const config = useRuntimeConfig()
  const date   = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const key    = `${folder}/${date}/${Date.now()}_${crypto.randomBytes(6).toString('hex')}.${resolvedExt}`

  const client = new OSS({
    region:          config.aliOssRegion,
    accessKeyId:     config.aliOssKeyId,
    accessKeySecret: config.aliOssKeySecret,
    bucket:          config.aliOssBucket,
    secure:          true, // 生成 https:// 签名 URL，避免后台（https）直传 OSS 时被浏览器拦截为混合内容
  })

  // 必须把 Content-Type 纳入签名，否则前端 PUT 时携带 Content-Type 会被 OSS 以签名不匹配拒绝（403）
  const uploadUrl = client.signatureUrl(key, {
    method: 'PUT',
    expires: 900,
    'Content-Type': mime,
  })

  return {
    uploadUrl,
    key,
    bucket:   config.aliOssBucket,
    cdnUrl:   `${config.public.ossCdnBaseUrl}/${key}`,
    mimeType: mime,
  }
})
