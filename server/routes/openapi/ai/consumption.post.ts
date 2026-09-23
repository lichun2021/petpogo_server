export default defineEventHandler(async event=>{
  const {phone,consumeType,quantity,refId}=await readBody(event) || {}
  if(typeof phone!=='string'||!phone.trim()||typeof consumeType!=='string'||!consumeType.trim()||typeof refId!=='string')throw createError({statusCode:400,message:'phone、consumeType 和稳定的 refId 必填'})
  const [[user]]:any=await useDb().query('SELECT id FROM t_user WHERE phone=? AND deleted=0',[phone.trim()])
  if(!user)throw createError({statusCode:404,message:'用户不存在'})
  return consumePointsEvent(String(user.id),'openapi-ai',refId,consumeType.trim(),quantity)
})
