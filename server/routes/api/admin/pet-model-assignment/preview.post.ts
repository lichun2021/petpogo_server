export default defineEventHandler(async event => {
  const pet = await readBody(event)
  if (!pet || typeof pet !== 'object' || Array.isArray(pet)) throw createError({ statusCode: 400, message: '请输入宠物信息' })
  return selectPetModel(useDb(), pet)
})
