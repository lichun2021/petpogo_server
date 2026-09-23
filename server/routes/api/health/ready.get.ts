/** 只读健康检查，不返回配置、版本细节或错误原文。 */
export default defineEventHandler(async event => {
  try {
    const [[schema]]:any=await useDb().query("SELECT version FROM t_schema_migration WHERE version='001-security-ledger.mjs'")
    if(!schema)throw new Error('schema')
    await useRedis().ping()
    return {ready:true}
  }catch{
    setResponseStatus(event,503)
    return {ready:false}
  }
})
