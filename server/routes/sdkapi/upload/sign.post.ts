// OSS 上传预签名（前端直传）
import OSS from 'ali-oss'
import crypto from 'node:crypto'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const { fileType, folder = 'media' } = await readBody(event)

  const config = useRuntimeConfig()
  const ext = fileType === 'video' ? 'mp4' : 'jpg'
  const key = `${folder}/${Date.now()}_${crypto.randomBytes(6).toString('hex')}.${ext}`

  const client = new OSS({
    region:          config.aliOssRegion,
    accessKeyId:     config.aliOssKeyId,
    accessKeySecret: config.aliOssKeySecret,
    bucket:          config.aliOssRawBucket,
  })

  // 生成预签名 PUT URL（15分钟有效）
  const url = client.signatureUrl(key, { method: 'PUT', expires: 900 })

  return {
    uploadUrl: url,
    key,
    bucket:    config.aliOssRawBucket,
    region:    config.aliOssRegion,
    cdnUrl:    `${config.public.ossCdnBaseUrl}/${key}`,
  }
})
