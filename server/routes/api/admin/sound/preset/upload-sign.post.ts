// POST /api/admin/sound/preset/upload-sign
// 后台管理员上传预设声音音频，返回 OSS 预签名 PUT URL
import OSS from 'ali-oss'
import crypto from 'node:crypto'

const AUDIO_MIME: Record<string, string> = {
  'audio/mpeg':  'mp3',
  'audio/mp3':   'mp3',
  'audio/aac':   'aac',
  'audio/wav':   'wav',
  'audio/x-wav': 'wav',
  'audio/m4a':   'm4a',
  'audio/x-m4a': 'm4a',
  'audio/ogg':   'ogg',
}

export default defineEventHandler(async (event) => {
  const { mimeType } = await readBody(event)
  if (!mimeType) throw createError({ statusCode: 400, message: '缺少 mimeType' })

  const mime = String(mimeType).toLowerCase()
  const ext  = AUDIO_MIME[mime]
  if (!ext) throw createError({ statusCode: 400, message: `不支持的音频格式: ${mimeType}，支持 mp3/aac/wav/m4a/ogg` })

  const config = useRuntimeConfig()
  const date   = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const key    = `sound/${date}/${Date.now()}_${crypto.randomBytes(6).toString('hex')}.${ext}`

  const client = new OSS({
    region:          config.aliOssRegion,
    accessKeyId:     config.aliOssKeyId,
    accessKeySecret: config.aliOssKeySecret,
    bucket:          config.aliOssBucket,
  })

  const uploadUrl = client.signatureUrl(key, {
    method: 'PUT',
    expires: 900,
    'Content-Type': mime,
  })

  return {
    uploadUrl,
    key,
    cdnUrl: `${config.public.ossCdnBaseUrl}/${key}`,
    mimeType: mime,
  }
})
