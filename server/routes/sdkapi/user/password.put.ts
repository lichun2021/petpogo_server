export default defineEventHandler(async event => {
  const user = await requireAuth(event)
  const { oldPassword, newPassword, code } = await readBody(event)
  validateUserPassword(newPassword)
  const [[current]]: any = await useDb().query('SELECT password,phone,credential_version FROM t_user WHERE id=? AND deleted=0', [user.userId])
  if (!current) throw createError({ statusCode: 404, message: '用户不存在' })
  if (code !== undefined) {
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) throw createError({ statusCode: 400, message: '验证码格式无效' })
    // 验证、次数递增、成功消费均原子执行；只能使用 password_reset 用途验证码。
    const ok = await useRedis().eval(`local raw=redis.call('GET',KEYS[1]); if not raw then return 0 end
      local d=cjson.decode(raw); if tonumber(d.attempts or 0)>=5 then redis.call('DEL',KEYS[1]); return 0 end
      if d.code==ARGV[1] then redis.call('DEL',KEYS[1]); return 1 end
      d.attempts=tonumber(d.attempts or 0)+1; local ttl=redis.call('TTL',KEYS[1]); if ttl>0 then redis.call('SET',KEYS[1],cjson.encode(d),'EX',ttl) end; return 0`, 1, RedisKey.smsPassword(current.phone), code)
    if (Number(ok) !== 1) throw createError({ statusCode: 400, message: '验证码错误或已过期' })
  } else if (!await verifyUserPassword(oldPassword, current.password)) {
    throw createError({ statusCode: 400, message: '旧密码错误或尚未设置，请使用短信验证设置密码' })
  }
  const hash = await hashUserPassword(newPassword)
  const [result]: any = await useDb().query('UPDATE t_user SET password=?,credential_version=credential_version+1 WHERE id=? AND credential_version=?', [hash, user.userId, Number(current.credential_version || 0)])
  if (result.affectedRows !== 1) throw createError({ statusCode: 409, message: '凭证已更新，请重新验证' })
  return { success: true, reLoginRequired: true }
})
