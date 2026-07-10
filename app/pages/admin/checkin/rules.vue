<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-base font-semibold text-stone-800">签到奖励档位</h2>
        <p class="text-xs text-stone-400 mt-0.5">配置每日签到奖励与连续签到奖励档位</p>
      </div>
      <UButton label="新增档位" color="amber" icon="i-heroicons-plus" @click="openModal()" />
    </div>

    <div class="bg-white rounded-2xl border overflow-hidden" style="border-color: #f0e6d8; box-shadow: 0 1px 4px rgba(0,0,0,0.04)">
      <div v-if="loading" class="flex justify-center py-10">
        <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 text-stone-400 animate-spin" />
      </div>
      <div v-else-if="!list.length" class="py-10 text-center text-sm text-stone-400">暂无数据</div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="bg-amber-50/50 border-b border-orange-100">
            <th class="text-left text-xs text-stone-500 font-medium py-3 px-4">类型</th>
            <th class="text-left text-xs text-stone-500 font-medium py-3 px-4">名称</th>
            <th class="text-left text-xs text-stone-500 font-medium py-3 px-4">连续天数门槛</th>
            <th class="text-left text-xs text-stone-500 font-medium py-3 px-4">奖励积分</th>
            <th class="text-left text-xs text-stone-500 font-medium py-3 px-4">积分类型</th>
            <th class="text-left text-xs text-stone-500 font-medium py-3 px-4">状态</th>
            <th class="text-left text-xs text-stone-500 font-medium py-3 px-4">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in list" :key="row.id" class="border-b border-stone-100 hover:bg-amber-50/30 transition-colors">
            <td class="py-3 px-4">
              <UBadge :label="row.rule_type === 1 ? '每日签到' : '连续签到'" :color="row.rule_type === 1 ? 'blue' : 'amber'" variant="subtle" size="xs" />
            </td>
            <td class="py-3 px-4">{{ row.name }}</td>
            <td class="py-3 px-4">{{ row.rule_type === 1 ? '-' : `${row.streak_days} 天` }}</td>
            <td class="py-3 px-4">{{ row.points_amount }}</td>
            <td class="py-3 px-4 text-xs text-stone-500">{{ typeName(row.points_type_code) }}</td>
            <td class="py-3 px-4">
              <UBadge :label="row.status === 1 ? '启用' : '停用'" :color="row.status === 1 ? 'green' : 'red'" variant="subtle" size="xs" />
            </td>
            <td class="py-3 px-4">
              <div class="flex gap-2">
                <UButton label="编辑" color="gray" variant="subtle" size="xs" @click="openModal(row)" />
                <UButton label="删除" color="red" variant="subtle" size="xs" @click="remove(row)" />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 新建/编辑弹窗 -->
    <div v-if="modal.show" class="fixed inset-0 z-50 flex items-center justify-center" style="background: rgba(0,0,0,0.4)">
      <div class="bg-white rounded-2xl shadow-xl w-96 p-6 space-y-4">
        <h3 class="font-semibold text-stone-800">{{ modal.editingId ? '编辑签到档位' : '新增签到档位' }}</h3>

        <div class="space-y-3">
          <div>
            <label class="text-xs text-stone-500 font-medium block mb-1">档位类型</label>
            <div class="flex gap-2">
              <button
                :class="['flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all', modal.ruleType === 1 ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-stone-500 border-stone-200']"
                @click="modal.ruleType = 1"
              >每日签到奖励</button>
              <button
                :class="['flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all', modal.ruleType === 2 ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-stone-500 border-stone-200']"
                @click="modal.ruleType = 2"
              >连续签到奖励</button>
            </div>
          </div>
          <div>
            <label class="text-xs text-stone-500 font-medium block mb-1">名称 *</label>
            <UInput v-model="modal.name" placeholder="如 连续7天" />
          </div>
          <div v-if="modal.ruleType === 2">
            <label class="text-xs text-stone-500 font-medium block mb-1">连续天数门槛 *</label>
            <UInput v-model.number="modal.streakDays" type="number" />
          </div>
          <div>
            <label class="text-xs text-stone-500 font-medium block mb-1">奖励积分 *</label>
            <UInput v-model.number="modal.pointsAmount" type="number" />
          </div>
          <div>
            <label class="text-xs text-stone-500 font-medium block mb-1">积分类型</label>
            <select
              v-model="modal.pointsTypeCode"
              class="w-full rounded-lg text-sm py-1.5 px-2 focus:border-amber-400 focus:ring-amber-400"
              style="border-color: #e7e5e4"
            >
              <option v-for="t in pointTypes" :key="t.type_code" :value="t.type_code">
                {{ t.name }}（{{ t.expire_days === 0 ? '永久' : `${t.expire_days}天` }}）
              </option>
            </select>
          </div>
          <div>
            <label class="text-xs text-stone-500 font-medium block mb-1">排序（越小越靠前）</label>
            <UInput v-model.number="modal.sortOrder" type="number" placeholder="0" />
          </div>
          <div v-if="modal.editingId">
            <label class="text-xs text-stone-500 font-medium block mb-1">状态</label>
            <div class="flex gap-2">
              <button
                :class="['flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all', modal.status === 1 ? 'bg-green-500 text-white border-green-500' : 'bg-white text-stone-500 border-stone-200']"
                @click="modal.status = 1"
              >启用</button>
              <button
                :class="['flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all', modal.status === 0 ? 'bg-red-500 text-white border-red-500' : 'bg-white text-stone-500 border-stone-200']"
                @click="modal.status = 0"
              >停用</button>
            </div>
          </div>
        </div>

        <div class="flex gap-2 pt-2">
          <UButton label="取消" color="gray" variant="outline" class="flex-1" @click="modal.show = false" />
          <UButton
            :label="modal.editingId ? '保存修改' : '创建'"
            color="amber" class="flex-1"
            :loading="modal.saving"
            :disabled="!modal.name.trim() || !modal.pointsAmount"
            @click="save"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'AdminCheckinRules' })
definePageMeta({ layout: 'admin' })

const toast       = useToast()
const loading     = ref(true)
const list        = ref<any[]>([])
const pointTypes  = ref<any[]>([])

// 积分类型 code → 显示名（含有效期提示）
function typeName(code: string) {
  const t = pointTypes.value.find(p => p.type_code === code)
  if (!t) return code
  return `${t.name}${t.expire_days === 0 ? '(永久)' : `(${t.expire_days}天)`}`
}

async function loadList() {
  loading.value = true
  try {
    const [d, pt] = await Promise.all([
      $fetch<any>('/api/admin/checkin/rules'),
      $fetch<any>('/api/admin/points/config'),
    ])
    list.value       = d.list
    pointTypes.value = pt.list
  } finally {
    loading.value = false
  }
}

const modal = reactive({
  show: false,
  editingId: null as number | null,
  ruleType: 1,
  streakDays: 1,
  pointsAmount: 1,
  pointsTypeCode: 'checkin',
  name: '',
  sortOrder: 0,
  status: 1,
  saving: false,
})

function openModal(row?: any) {
  if (row) {
    Object.assign(modal, {
      show: true, editingId: row.id, ruleType: row.rule_type, streakDays: row.streak_days,
      pointsAmount: row.points_amount, pointsTypeCode: row.points_type_code || 'checkin', name: row.name,
      sortOrder: row.sort_order, status: row.status,
    })
  } else {
    Object.assign(modal, {
      show: true, editingId: null, ruleType: 1, streakDays: 1, pointsAmount: 1,
      pointsTypeCode: 'checkin', name: '', sortOrder: 0, status: 1,
    })
  }
}

async function save() {
  modal.saving = true
  try {
    const isEdit = modal.editingId != null
    const body = {
      rule_type: modal.ruleType,
      streak_days: modal.ruleType === 1 ? 1 : modal.streakDays,
      points_amount: modal.pointsAmount,
      points_type_code: modal.pointsTypeCode,
      name: modal.name.trim(),
      sort_order: modal.sortOrder,
      status: modal.status,
    }
    await $fetch(isEdit ? `/api/admin/checkin/rules/${modal.editingId}` : '/api/admin/checkin/rules', {
      method: isEdit ? 'PUT' : 'POST',
      body,
    })
    toast.add({ title: '保存成功', color: 'green' })
    modal.show = false
    loadList()
  } catch (e: any) {
    toast.add({ title: '保存失败', description: e?.data?.message, color: 'red' })
  } finally {
    modal.saving = false
  }
}

async function remove(row: any) {
  try {
    await $fetch(`/api/admin/checkin/rules/${row.id}`, { method: 'DELETE' })
    toast.add({ title: '删除成功', color: 'green' })
    loadList()
  } catch {
    toast.add({ title: '删除失败', color: 'red' })
  }
}

onMounted(loadList)
</script>
