// POST /api/admin/music/upload-sign
// 管理员上传音乐文件 / 封面图 / 分类图标专用预签名接口
// folder: 'music'       → 音频文件 (mp3/aac/wav/m4a)
// folder: 'music-icon'  → 封面图 / 分类图标 (jpg/png/webp)
import OSS from 'ali-oss'
import crypto from 'node:crypto'

const MIME_EXT: Record<string, string> = {
  // 图片
  'image/jpeg':  'jpg',
  'image/jpg':   'jpg',
  'image/png':   'png',
  'image/webp':  'webp',
  // 音频
  'audio/mpeg':  'mp3',
  'audio/mp3':   'mp3',
  'audio/aac':   'aac',
  'audio/wav':   'wav',
  'audio/x-wav': 'wav',
  'audio/m4a':   'm4a',
  'audio/x-m4a': 'm4a',
}

export default defineEventHandler(async (event) => {

  const {
    mimeType,
    folder = 'music-icon',  // 'music' | 'music-icon'
  } = await readBody(event)

  if (!mimeType) throw createError({ statusCode: 400, message: '缺少 mimeType' })

  const mime = (mimeType as string).toLowerCase()
  const ext  = MIME_EXT[mime]
  if (!ext) throw createError({ statusCode: 400, message: `不支持的文件类型: ${mimeType}` })

  const config  = useRuntimeConfig()
  const date    = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const key     = `${folder}/${date}/${Date.now()}_${crypto.randomBytes(6).toString('hex')}.${ext}`

  const client = new OSS({
    region:          config.aliOssRegion,
    accessKeyId:     config.aliOssKeyId,
    accessKeySecret: config.aliOssKeySecret,
    bucket:          config.aliOssBucket,   // 音乐/图标均上传到 CDN 桶，无需转码
  })

  const uploadUrl = client.signatureUrl(key, { method: 'PUT', expires: 900 })

  return {
    uploadUrl,
    key,
    bucket:   config.aliOssBucket,
    cdnUrl:   `${config.public.ossCdnBaseUrl}/${key}`,
    mimeType: mime,
  }
})
