/** 生产核心配置必须显式提供，构建成功不能替代启动检查。 */
export default defineNitroPlugin(() => {
  if (process.env.NODE_ENV !== 'production') return
  const config=useRuntimeConfig()
  for(const name of ['jwtSecret','appApiSecret','openapiKey','openapiSecret'] as const){
    const value=config[name]
    if(typeof value!=='string'||value.length<16||/change.?in.?prod|default_secret/i.test(value))throw new Error(`生产配置 ${name} 缺失或不安全`)
  }
})
