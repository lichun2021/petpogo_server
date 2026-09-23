import { SignJWT, jwtVerify } from 'jose'

const getSecret = () => {
  const config = useRuntimeConfig()
  if (!config.jwtSecret) throw createError({statusCode:503,message:'管理员签名密钥未配置'})
  return new TextEncoder().encode(config.jwtSecret)
}

export interface JwtPayload {
  adminId: string
  username: string
  role: 'super_admin' | 'admin'
}

export async function signJwt(payload: JwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('6h')
    .sign(getSecret())
}

export async function verifyJwt(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, getSecret())
  return payload as unknown as JwtPayload
}
