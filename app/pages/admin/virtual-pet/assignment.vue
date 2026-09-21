<template>
  <div class="space-y-4 text-sm text-stone-700">
    <div class="flex items-center gap-3">
      <h2 class="font-bold text-base">宠物形象分配</h2>
      <span class="text-xs text-stone-400">仅影响新宠物；已有形象保留</span>
      <UButton label="保存配置" color="amber" class="ml-auto" :loading="saving" :disabled="loading || !!loadError" @click="save" />
    </div>
    <p v-if="loadError" class="text-red-600">{{ loadError }} <button class="underline" @click="load">重试</button></p>
    <p v-if="loading">正在加载…</p>
    <template v-else-if="!loadError">
      <section class="bg-white border border-orange-100 rounded-2xl p-5 space-y-3">
        <h3 class="font-semibold">默认保底形象</h3>
        <p class="text-xs text-stone-500">未命中规则时使用。必须选择启用形象，更换前不能删除或停用。</p>
        <select v-model="config.defaultModelId" class="field">
          <option value="">请选择默认 GLB</option><option v-for="m in available" :key="m.id" :value="m.id">{{ m.name }}</option>
        </select>
      </section>
      <section class="bg-white border border-orange-100 rounded-2xl p-5 space-y-3">
        <div class="flex justify-between"><h3 class="font-semibold">匹配规则</h3><UButton label="新增规则" color="amber" variant="outline" size="sm" @click="addRule" /></div>
        <p class="text-xs text-stone-500">条件同时满足才命中。优先级数字越大越先匹配；相同优先级按规则 ID 固定排序。停用形象会被跳过。品种精确匹配，忽略首尾空格及英文大小写。</p>
        <p v-if="!config.rules.length" class="text-stone-400">暂无规则，全部使用默认形象。</p>
        <div v-for="(r, i) in config.rules" :key="r.id || i" class="border border-stone-200 rounded-xl p-4 space-y-3">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label>规则名称<input v-model="r.name" maxlength="100" class="field" placeholder="如：布偶猫" /></label>
            <label>优先级<input v-model.number="r.priority" type="number" min="-100000" max="100000" class="field" /></label>
            <label>分配形象<select v-model="r.modelId" class="field"><option value="">请选择</option><option v-for="m in models" :key="m.id" :value="m.id">{{ m.name }}{{ m.enabled ? '' : '（已停用）' }}</option><option v-if="r.modelId && !models.some(m => m.id === r.modelId)" :value="r.modelId">原形象已删除，请重新选择</option></select></label>
            <label>宠物类型<select v-model="r.species" class="field"><option value="all">不限</option><option value="cat">猫</option><option value="dog">狗</option></select></label>
            <label>品种（多个用逗号分隔）<input v-model="r.breedText" class="field" placeholder="留空表示不限" /></label>
            <label>性别<select v-model="r.gender" class="field"><option :value="null">不限</option><option :value="1">公</option><option :value="2">母</option></select></label>
          </div>
          <div class="flex items-center justify-between"><label><input v-model="r.enabled" type="checkbox" :true-value="1" :false-value="0" /> 启用</label><UButton label="移除规则" color="red" variant="ghost" size="xs" @click="config.rules.splice(i, 1)" /></div>
        </div>
      </section>
      <section class="bg-white border border-orange-100 rounded-2xl p-5 space-y-3">
        <div class="flex justify-between"><h3 class="font-semibold">品种与类型对照</h3><UButton label="新增品种" color="amber" variant="outline" size="sm" @click="config.breedMappings.push({ breed: '', species: 'cat' })" /></div>
        <p class="text-xs text-stone-500">对方接口未提供猫/狗类型时，按此表识别。品种别名可分别登记；未知类型仍可匹配“不限类型”的规则，否则使用保底。</p>
        <div v-for="(m, i) in config.breedMappings" :key="i" class="flex gap-3 items-center">
          <input v-model="m.breed" class="field" placeholder="对方接口中的品种名称" maxlength="100" />
          <select v-model="m.species" class="field"><option value="cat">猫</option><option value="dog">狗</option></select>
          <UButton label="移除" color="red" variant="ghost" @click="config.breedMappings.splice(i, 1)" />
        </div>
      </section>
      <section class="bg-white border border-orange-100 rounded-2xl p-5 space-y-3">
        <h3 class="font-semibold">匹配预览</h3>
        <p class="text-xs text-stone-500">使用已保存的配置。修改规则后请先保存，再预览。</p>
        <div class="flex gap-3">
          <select v-model="preview.species" class="field"><option value="other">未知（按品种识别）</option><option value="cat">猫</option><option value="dog">狗</option></select>
          <input v-model="preview.breed" class="field" placeholder="品种" />
          <select v-model="preview.gender" class="field"><option :value="0">未知性别</option><option :value="1">公</option><option :value="2">母</option></select>
          <UButton label="预览" color="amber" :loading="previewing" :disabled="dirty" @click="runPreview" />
        </div>
        <p v-if="dirty" class="text-amber-600">配置有未保存的修改。</p>
        <div v-if="result" class="flex gap-4 items-center bg-amber-50 p-4 rounded-xl">
          <img v-if="result.model.thumbnail_url" :src="result.model.thumbnail_url" class="w-20 h-20 object-contain" alt="形象预览" />
          <div><p class="font-semibold">{{ result.model.name }}</p><p>{{ result.source === 'rule' ? `命中规则：${result.ruleName}` : '未命中有效规则，使用默认保底' }}</p><p>识别类型：{{ result.species === 'cat' ? '猫' : result.species === 'dog' ? '狗' : '未知' }}</p></div>
        </div>
      </section>
    </template>
  </div>
</template>
<script setup lang="ts">
defineOptions({ name: 'AdminPetModelAssignment' })
definePageMeta({ layout: 'admin' })
const toast = useToast()
const config = reactive<any>({ defaultModelId: '', rules: [], breedMappings: [] })
const models = ref<any[]>([])
const available = computed(() => models.value.filter(m => m.enabled))
const loading = ref(true), saving = ref(false), previewing = ref(false), loadError = ref(''), saved = ref('')
const preview = reactive({ species: 'other', breed: '', gender: 0 })
const result = ref<any>(null)
const dirty = computed(() => JSON.stringify(config) !== saved.value)
watch([() => JSON.stringify(config), () => JSON.stringify(preview)], () => { result.value = null })
function error(e: any) { return e?.data?.message || '操作失败，请稍后重试' }
async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const [c, m] = await Promise.all([$fetch<any>('/api/admin/pet-model-assignment'), $fetch<any>('/api/admin/pet-models/list')])
    Object.assign(config, { defaultModelId: c.defaultModelId, rules: c.rules.map((r: any) => ({ ...r, breedText: r.breeds.join('，') })), breedMappings: c.breedMappings })
    models.value = m.list
    saved.value = JSON.stringify(config)
  } catch (e) { loadError.value = error(e) } finally { loading.value = false }
}
function addRule() { config.rules.push({ name: '', species: 'all', breedText: '', gender: null, priority: 10, enabled: 1, modelId: '' }) }
async function save() {
  saving.value = true
  try {
    await $fetch('/api/admin/pet-model-assignment', { method: 'PUT', body: { ...config, rules: config.rules.map((r: any) => ({ ...r, breeds: r.breedText.split(/[,，]/).map((s: string) => s.trim()).filter(Boolean) })) } })
    await load()
    toast.add({ title: '形象分配配置已保存', color: 'green' })
  } catch (e) { toast.add({ title: error(e), color: 'red' }) } finally { saving.value = false }
}
async function runPreview() {
  previewing.value = true; result.value = null
  try { result.value = await $fetch('/api/admin/pet-model-assignment/preview', { method: 'POST', body: preview }) }
  catch (e) { toast.add({ title: error(e), color: 'red' }) } finally { previewing.value = false }
}
onMounted(load)
</script>
<style scoped>
.field { display: block; width: 100%; border: 1px solid #e7e5e4; border-radius: 8px; padding: 8px 12px; background: white; margin-top: 4px; }
</style>
