import { SignJWT, jwtVerify } from 'jose'

const getSecret = () => {
  const config = useRuntimeConfig()
  return new TextEncoder().encode(config.jwtSecret || 'petpogo_default_secret')
}

export interface JwtPayload {
  userId: string
  phone:  string
  role?:  string
}

export async function signJwt(payload: JwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getSecret())
}

export async function verifyJwt(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, getSecret())
  return payload as unknown as JwtPayload
}
