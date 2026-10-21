<template>
  <div class="space-y-5">
    <AdminPageHeader title="宠物圈发布计划" description="为当天有行为记录的宠物统一安排图片圈和文字圈">
      <UButton label="重新加载" icon="i-heroicons-arrow-path" color="neutral" variant="outline" :loading="loading" :disabled="saving || loading" @click="load" />
      <UButton label="保存计划" icon="i-heroicons-check" :loading="saving" :disabled="!loaded || loading || !!loadError || !dirty || errors.length > 0" @click="save" />
    </AdminPageHeader>
    <AdminListState v-if="loading || loadError" :loading="loading" :has-data="loaded" :empty="false" :error="loadError" :request-id="requestId" @retry="load" />
    <fieldset v-if="loaded" :disabled="saving" class="contents">
      <section class="admin-panel p-5 sm:p-6">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><UIcon name="i-heroicons-clock" class="size-6" /></div>
            <div><h2 class="text-base font-semibold text-stone-900">定时发送</h2><p class="mt-1 text-sm text-stone-500">{{ form.enabled ? '按下面的时间点自动发布' : '已暂停自动发布，已配置的时间点仍会保留' }}</p></div>
          </div>
          <div class="flex items-center gap-3"><UBadge :label="form.enabled ? '已启用' : '已暂停'" :color="form.enabled ? 'success' : 'neutral'" variant="soft" /><USwitch v-model="form.enabled" aria-label="启用宠物圈定时发送" /></div>
        </div>
        <div class="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-stone-100 pt-4 text-sm text-stone-500"><span class="flex items-center gap-1.5"><UIcon name="i-heroicons-globe-asia-australia" class="size-4" />北京时间 · Asia/Shanghai</span><span>适用于所有当天有行为记录的宠物</span></div>
      </section>
      <div class="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <section v-for="kind in kinds" :key="kind.key" class="admin-panel flex min-w-0 flex-col">
          <header class="flex items-center justify-between gap-3 border-b border-stone-100 px-5 py-4">
            <div class="flex items-center gap-2.5"><UIcon :name="kind.icon" class="size-5 text-primary" /><h2 class="text-base font-semibold text-stone-900">{{ kind.title }}</h2></div>
            <UBadge :label="`已配置 ${form[kind.key].length} 次/天`" color="neutral" variant="soft" />
          </header>
          <div class="flex-1 p-5">
            <p class="mb-4 text-sm text-stone-500">{{ kind.description }}</p>
            <div v-if="!form[kind.key].length" class="rounded-xl border border-dashed border-stone-200 bg-stone-50 px-4 py-8 text-center"><p class="text-sm font-medium text-stone-700">暂不自动发送{{ kind.title }}</p><p class="mt-1 text-xs text-stone-500">添加每日时间点即可安排发送</p></div>
            <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div v-for="(time, index) in form[kind.key]" :key="index" class="flex min-w-0 items-center gap-2 rounded-lg border border-stone-200 p-3">
                <label :for="`${kind.key}-${index}`" class="shrink-0 text-xs text-stone-500">时间 {{ index + 1 }}</label>
                <input :id="`${kind.key}-${index}`" v-model="form[kind.key][index]" type="time" step="60" required class="min-w-0 flex-1 rounded-md border border-stone-200 bg-white px-2 py-1.5 text-sm text-stone-900 focus-visible:outline-2 focus-visible:outline-primary" :aria-label="`${kind.title}第${index + 1}个时间点`" />
                <UButton icon="i-heroicons-x-mark" color="neutral" variant="ghost" size="xs" :aria-label="`移除${kind.title}第${index + 1}个时间点`" @click="form[kind.key].splice(index, 1)" />
              </div>
            </div>
            <UButton label="添加时间点" icon="i-heroicons-plus" color="primary" variant="outline" size="sm" class="mt-4" :disabled="form[kind.key].length >= 1440" @click="addTime(kind.key)" />
          </div>
          <footer class="border-t border-stone-100 bg-stone-50/60 px-5 py-3 text-xs text-stone-500">{{ form[kind.key].length ? `保存后按时间升序执行：${[...form[kind.key]].sort().join('、')}` : '时间列表为空时，关闭此类定时发送' }}</footer>
        </section>
      </div>
      <div v-if="errors.length" class="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700" role="alert"><p v-for="message in errors" :key="message">{{ message }}</p></div>
      <div class="admin-panel px-5 py-4 text-sm leading-6 text-stone-600">
        <p class="font-medium text-stone-800">计划生效规则</p>
        <p class="mt-1">本页保存全局计划，实际生成与发布由读取此计划的模型调度器执行。</p>
        <p class="mt-1">保存的是全局计划。暂停总开关不影响手动生成；删除某一类的全部时间点，仅暂停该类定时发送。</p>
        <p class="mt-1">调度器每 30 秒读取最新计划，已开始的任务可能继续完成。当天按宠物、日期、类型与时间档位序号去重，调整时间不会重发已完成的档位；完整新计划从次日起执行。</p>
        <p class="mt-1">时间点后的 5 分钟内可触发或补发，超过窗口的时间点不会因修改计划立即补发。</p>
      </div>
      <p v-if="dirty" class="text-sm text-primary" role="status">有未保存的修改，保存后才会更新发送计划。</p>
    </fieldset>
  </div>
</template>
<script setup lang="ts">
import type { MomentScheduleInput, MomentScheduleResponse } from '~~/shared/types/momentSchedule'

defineOptions({ name: 'AdminMomentSchedule' })
definePageMeta({ layout: 'admin' })
const toast = useToast()
const loading = ref(true), saving = ref(false), loaded = ref(false), loadError = ref(''), requestId = ref(''), saved = ref('')
const form = reactive<MomentScheduleInput>({ enabled: false, image_times: [], text_times: [] })
const kinds = [
  { key: 'image_times', title: '图片圈', icon: 'i-heroicons-photo', description: '每个时间点发送一条图片圈' },
  { key: 'text_times', title: '文字圈', icon: 'i-heroicons-pencil-square', description: '每个时间点发送一条纯文字圈' },
] as const
const payload = computed(() => ({ enabled: form.enabled, image_times: [...form.image_times].sort(), text_times: [...form.text_times].sort() }))
const dirty = computed(() => loaded.value && JSON.stringify(payload.value) !== saved.value)
useAdminDirtyForm(dirty)
const errors = computed(() => kinds.flatMap(kind => {
  const times = form[kind.key]
  if (times.some(time => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) return [`请填写有效的${kind.title}时间（00:00至23:59）`]
  return new Set(times).size !== times.length ? [`${kind.title}不能包含重复时间点`] : []
}))
function accept(info: MomentScheduleInput) {
  form.enabled = info.enabled; form.image_times = [...info.image_times]; form.text_times = [...info.text_times]
  saved.value = JSON.stringify(payload.value); loaded.value = true
}
function errorText(error: any) { return error?.data?.tip || error?.data?.message || '操作失败，请稍后重试' }
async function load() {
  if (saving.value || (dirty.value && !window.confirm('重新加载将丢弃未保存修改，是否继续？'))) return
  loading.value = true; loadError.value = ''; requestId.value = ''
  try { accept((await $fetch<MomentScheduleResponse>('/api/admin/moment/schedule')).info) }
  catch (error: any) { loadError.value = errorText(error); requestId.value = error?.response?.headers?.get?.('x-request-id') || '' }
  finally { loading.value = false }
}
async function save() {
  if (saving.value || loading.value || loadError.value || !loaded.value || errors.value.length || !dirty.value) return
  saving.value = true
  try {
    accept((await $fetch<MomentScheduleResponse>('/api/admin/moment/schedule', { method: 'POST', body: payload.value })).info)
    toast.add({ title: '发送计划已保存', description: '模型调度器可读取最新配置，无需重启', color: 'success' })
  } catch (error) { toast.add({ title: '保存失败，修改已保留', description: errorText(error), color: 'error' }) }
  finally { saving.value = false }
}
function addTime(key: 'image_times' | 'text_times') {
  const existing = new Set(form[key])
  const candidate = ['09:00', '12:00', '15:00', '18:00', '21:00'].find(time => !existing.has(time))
    ?? Array.from({ length: 1440 }, (_, n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`).find(time => !existing.has(time))
  if (candidate) form[key].push(candidate)
}
onMounted(load)
</script>
