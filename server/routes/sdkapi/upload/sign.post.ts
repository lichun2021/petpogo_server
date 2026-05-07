// OSS 上传预签名（前端直传）— 支持具体 MIME 类型
import OSS from 'ali-oss'
import crypto from 'node:crypto'

// MIME → 扩展名映射
const MIME_EXT: Record<string, string> = {
  'image/jpeg':     'jpg',
  'image/jpg':      'jpg',
  'image/png':      'png',
  'image/webp':     'webp',
  'image/heic':     'heic',
  'video/mp4':      'mp4',
  'video/quicktime':'mov',
  // 音频格式（AI 分析用）
  'audio/wav':      'wav',
  'audio/x-wav':    'wav',
  'audio/mpeg':     'mp3',
  'audio/mp3':      'mp3',
  'audio/m4a':      'm4a',
  'audio/x-m4a':    'm4a',
  'audio/aac':      'aac',
}

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const {
    fileType,          // 'image' | 'video' | 'audio'（向后兼容旧调用）
    mimeType,          // 'image/jpeg' | 'audio/wav' | 'video/mp4' 等（优先使用）
    folder = 'media',  // 存储目录前缀，发帖时传 'posts'，AI分析时传 'ai'
  } = await readBody(event)

  // 优先从 mimeType 解析扩展名，否则退回旧逻辑
  const resolvedMime = (mimeType as string | undefined)?.toLowerCase() || ''
  const isVideo = resolvedMime.startsWith('video/') || fileType === 'video'
  const isAudio = resolvedMime.startsWith('audio/') || fileType === 'audio'
  const ext = MIME_EXT[resolvedMime] ?? (isVideo ? 'mp4' : isAudio ? 'wav' : 'jpg')

  const config = useRuntimeConfig()
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '') // 按日期分目录
  const mediaDir = isVideo ? 'video' : isAudio ? 'audio' : 'picture'  // 按类型分子目录
  const key = `${folder}/${date}/${mediaDir}/${Date.now()}_${crypto.randomBytes(6).toString('hex')}.${ext}`

  // 视频上传到原始桶（触发 MPS 转码），图片和音频上传到 CDN 桶（直接可用）
  const bucket = isVideo ? config.aliOssRawBucket : config.aliOssBucket

  const client = new OSS({
    region:          config.aliOssRegion,
    accessKeyId:     config.aliOssKeyId,
    accessKeySecret: config.aliOssKeySecret,
    bucket,
  })

  // 生成预签名 PUT URL（15分钟有效）
  const uploadUrl = client.signatureUrl(key, { method: 'PUT', expires: 900 })

  return {
    uploadUrl,
    key,
    bucket,
    region:   config.aliOssRegion,
    // 图片和视频均直接返回 CDN URL（未配置 MPS 时视频同样直接可用）
    cdnUrl:   `${config.public.ossCdnBaseUrl}/${key}`,
    isVideo,
    mimeType: resolvedMime || (isVideo ? 'video/mp4' : 'image/jpeg'),
  }
})
