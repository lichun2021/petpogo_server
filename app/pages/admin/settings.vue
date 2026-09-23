<template>
  <div class="space-y-5">

    <!-- 页头 -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-semibold text-stone-800">系统设置</h2>
        <p class="text-xs text-stone-500 mt-0.5">管理全局系统配置参数</p>
      </div>
      <UButton
        label="保存全部"
        color="primary"
        icon="i-heroicons-check"
        :loading="saving"
        @click="saveAll"
      />
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="flex justify-center py-16">
      <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 text-stone-500 animate-spin" />
    </div>

    <template v-else>

      <!-- SMS 短信网关 -->
      <div
        class="bg-white rounded-xl border overflow-hidden"
        style="border-color: #e7e5e4; box-shadow: 0 1px 4px rgba(0,0,0,0.04)"
      >
        <!-- 分组标题 -->
        <div class="flex items-center gap-2.5 px-5 py-3.5 border-b" style="border-color: #e7e5e4; background: #fffbf5">
          <div class="w-7 h-7 rounded-lg flex items-center justify-center" style="background: #fef3c7">
            <UIcon name="i-heroicons-chat-bubble-left-ellipsis" class="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <p class="text-sm font-semibold text-stone-800">短信网关</p>
            <p class="text-xs text-stone-500">控制短信验证码发送行为</p>
          </div>
          <!-- 核心开关：醒目放在标题行 -->
          <div class="ml-auto flex items-center gap-2.5">
            <span class="text-xs text-stone-500">
              {{ getSetting('sms_enabled') === '1' ? '已启用' : '已关闭' }}
            </span>
            <button
              :class="[
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none',
                getSetting('sms_enabled') === '1' ? 'bg-amber-500' : 'bg-stone-300'
              ]"
              @click="toggleBoolean('sms_enabled')"
            >
              <span
                :class="[
                  'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200',
                  getSetting('sms_enabled') === '1' ? 'translate-x-6' : 'translate-x-1'
                ]"
              />
            </button>
          </div>
        </div>

        <!-- 短信配置项 -->
        <div class="divide-y" style="divide-color: #faf6f2">
          <template v-for="item in getGroup('sms')" :key="item.key">
            <!-- boolean 类型（sms_enabled 已在标题栏处理，跳过） -->
            <div v-if="item.key !== 'sms_enabled'" class="flex items-start gap-4 px-5 py-4">
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-stone-700">{{ item.label }}</p>
                <p class="text-xs text-stone-500 mt-0.5">{{ item.description }}</p>
              </div>
              <!-- number / text -->
              <div class="w-48 flex-shrink-0">
                <UInput
                  v-model="localValues[item.key]"
                  :type="item.type === 'number' ? 'number' : 'text'"
                  size="sm"
                  :disabled="getSetting('sms_enabled') === '0' && item.key !== 'sms_provider'"
                />
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- 通用设置 -->
      <div
        class="bg-white rounded-xl border overflow-hidden"
        style="border-color: #e7e5e4; box-shadow: 0 1px 4px rgba(0,0,0,0.04)"
      >
        <div class="flex items-center gap-2.5 px-5 py-3.5 border-b" style="border-color: #e7e5e4; background: #fffbf5">
          <div class="w-7 h-7 rounded-lg flex items-center justify-center" style="background: #dbeafe">
            <UIcon name="i-heroicons-cog-6-tooth" class="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p class="text-sm font-semibold text-stone-800">通用设置</p>
            <p class="text-xs text-stone-500">基础应用参数配置</p>
          </div>
        </div>

        <div class="divide-y" style="divide-color: #faf6f2">
          <div
            v-for="item in getGroup('general')"
            :key="item.key"
            class="flex items-start gap-4 px-5 py-4"
          >
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-stone-700">{{ item.label }}</p>
              <p class="text-xs text-stone-500 mt-0.5">{{ item.description }}</p>
            </div>
            <!-- boolean 开关 -->
            <div v-if="item.type === 'boolean'" class="flex items-center gap-2 flex-shrink-0 mt-0.5">
              <span class="text-xs text-stone-500">
                {{ localValues[item.key] === '1' ? '是' : '否' }}
              </span>
              <button
                :class="[
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none',
                  localValues[item.key] === '1' ? 'bg-amber-500' : 'bg-stone-300'
                ]"
                @click="toggleBoolean(item.key)"
              >
                <span
                  :class="[
                    'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200',
                    localValues[item.key] === '1' ? 'translate-x-6' : 'translate-x-1'
                  ]"
                />
              </button>
            </div>
            <!-- number / text -->
            <div v-else class="w-48 flex-shrink-0">
              <UInput
                v-model="localValues[item.key]"
                :type="item.type === 'number' ? 'number' : 'text'"
                size="sm"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- OSS 配置 -->
      <div
        class="bg-white rounded-xl border overflow-hidden"
        style="border-color: #e7e5e4; box-shadow: 0 1px 4px rgba(0,0,0,0.04)"
      >
        <div class="flex items-center gap-2.5 px-5 py-3.5 border-b" style="border-color: #e7e5e4; background: #fffbf5">
          <div class="w-7 h-7 rounded-lg flex items-center justify-center" style="background: #dcfce7">
            <UIcon name="i-heroicons-cloud" class="w-4 h-4 text-green-600" />
          </div>
          <div>
            <p class="text-sm font-semibold text-stone-800">OSS / 存储</p>
            <p class="text-xs text-stone-500">对象存储相关配置</p>
          </div>
        </div>

        <div class="divide-y" style="divide-color: #faf6f2">
          <div
            v-for="item in getGroup('oss')"
            :key="item.key"
            class="flex items-start gap-4 px-5 py-4"
          >
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-stone-700">{{ item.label }}</p>
              <p class="text-xs text-stone-500 mt-0.5">{{ item.description }}</p>
            </div>
            <div class="w-80 flex-shrink-0">
              <UInput v-model="localValues[item.key]" size="sm" />
            </div>
          </div>
        </div>
      </div>

      <!-- 客户端配置（App 运行时拉取，可增删） -->
      <div
        class="bg-white rounded-xl border overflow-hidden"
        style="border-color: #e7e5e4; box-shadow: 0 1px 4px rgba(0,0,0,0.04)"
      >
        <div class="flex items-center gap-2.5 px-5 py-3.5 border-b" style="border-color: #e7e5e4; background: #fffbf5">
          <div class="w-7 h-7 rounded-lg flex items-center justify-center" style="background: #ede9fe">
            <UIcon name="i-heroicons-device-phone-mobile" class="w-4 h-4 text-purple-600" />
          </div>
          <div class="flex-1">
            <p class="text-sm font-semibold text-stone-800">客户端配置</p>
            <p class="text-xs text-stone-500">App 运行时通过 /sdkapi/config/client 拉取；secret 类型对 App 脱敏返回 ***</p>
          </div>
          <UButton label="新增配置" color="primary" variant="soft" size="xs" icon="i-heroicons-plus" @click="openClientModal()" />
        </div>

        <div v-if="getGroup('client').length === 0" class="py-8 text-center text-xs text-stone-500">
          暂无客户端配置，点击右上角「新增配置」
        </div>
        <div v-else class="divide-y" style="divide-color: #faf6f2">
          <div
            v-for="item in getGroup('client')"
            :key="item.key"
            class="flex items-start gap-4 px-5 py-4"
          >
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <p class="text-sm font-medium text-stone-700">{{ item.label }}</p>
                <UBadge :label="item.type" :color="typeColor(item.type)" variant="subtle" size="xs" />
                <UBadge v-if="item.status === 0" label="已停用" color="neutral" variant="subtle" size="xs" />
              </div>
              <p class="text-xs text-stone-500 mt-0.5 font-mono">{{ item.key }}</p>
              <p v-if="item.description" class="text-xs text-stone-500 mt-0.5">{{ item.description }}</p>
            </div>
            <!-- boolean 开关 -->
            <div v-if="item.type === 'boolean'" class="flex items-center gap-2 flex-shrink-0 mt-0.5">
              <span class="text-xs text-stone-500">
                {{ localValues[item.key] === '1' ? '是' : '否' }}
              </span>
              <button
                :class="[
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none',
                  localValues[item.key] === '1' ? 'bg-amber-500' : 'bg-stone-300'
                ]"
                @click="toggleBoolean(item.key)"
              >
                <span
                  :class="[
                    'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200',
                    localValues[item.key] === '1' ? 'translate-x-6' : 'translate-x-1'
                  ]"
                />
              </button>
            </div>
            <!-- secret 类型：密码框 + 显示/隐藏 -->
            <div v-else-if="item.type === 'secret'" class="w-64 flex-shrink-0 flex items-center gap-1">
              <UInput
                v-model="localValues[item.key]"
                :type="secretVisible[item.key] ? 'text' : 'password'"
                size="sm"
                class="flex-1"
              />
              <UButton
                :icon="secretVisible[item.key] ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
                color="neutral" variant="ghost" size="xs"
                @click="secretVisible[item.key] = !secretVisible[item.key]"
              />
            </div>
            <!-- number / text -->
            <div v-else class="w-64 flex-shrink-0">
              <UInput
                v-model="localValues[item.key]"
                :type="item.type === 'number' ? 'number' : 'text'"
                size="sm"
              />
            </div>
            <!-- 删除 -->
            <UButton
              icon="i-heroicons-trash"
              color="error" variant="ghost" size="xs"
              class="flex-shrink-0 mt-0.5"
              @click="deleteClient(item)"
            />
          </div>
        </div>
      </div>

    </template>

  </div>

    <!-- 新增客户端配置 弹窗 -->
    <div v-if="clientModal.show" class="fixed inset-0 z-50 flex items-center justify-center" style="background: rgba(0,0,0,0.4)">
      <div class="bg-white rounded-2xl shadow-xl w-96 p-6 space-y-4">
        <h3 class="font-semibold text-stone-800">新增客户端配置</h3>
        <div class="space-y-3">
          <div>
            <label class="text-xs text-stone-500 font-medium block mb-1">配置键 key *</label>
            <UInput v-model="clientModal.key" placeholder="如 client_xxx_key（建议 client_ 前缀）" />
          </div>
          <div>
            <label class="text-xs text-stone-500 font-medium block mb-1">显示名称 label *</label>
            <UInput v-model="clientModal.label" placeholder="如 高德地图Key" />
          </div>
          <div>
            <label class="text-xs text-stone-500 font-medium block mb-1">值</label>
            <UInput v-model="clientModal.value" placeholder="配置值（secret 类型会被脱敏）" />
          </div>
          <div>
            <label class="text-xs text-stone-500 font-medium block mb-1">值类型</label>
            <select v-model="clientModal.type" class="admin-select w-full rounded-lg text-sm py-1.5 px-2" style="border-color: #e7e5e4">
              <option value="text">text（明文字符串）</option>
              <option value="secret">secret（对App脱敏返回 ***）</option>
              <option value="boolean">boolean（开关，值 1/0）</option>
              <option value="number">number（数字）</option>
            </select>
          </div>
          <div>
            <label class="text-xs text-stone-500 font-medium block mb-1">说明（可选）</label>
            <UTextarea v-model="clientModal.description" :rows="2" placeholder="描述这个配置的用途" />
          </div>
        </div>
        <div class="flex gap-2 pt-2">
          <UButton label="取消" color="neutral" variant="outline" class="flex-1" @click="clientModal.show = false" />
          <UButton label="创建" color="primary" class="flex-1" :loading="clientModal.saving" :disabled="!clientModal.key.trim() || !clientModal.label.trim()" @click="createClient" />
        </div>
      </div>
    </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'AdminSettings' })
definePageMeta({ layout: 'admin' })

const toast  = useToast()
const loading = ref(true)
const saving  = ref(false)

// 原始列表 & 本地编辑副本
const allItems   = ref<any[]>([])
const localValues = reactive<Record<string, string>>({})

// secret 字段的明文显示开关（按 key）
const secretVisible = reactive<Record<string, boolean>>({})

// 分组快捷方法
function getGroup(name: string) {
  return allItems.value.filter(i => i.group_name === name)
}

function getSetting(key: string) {
  return localValues[key] ?? ''
}

function toggleBoolean(key: string) {
  localValues[key] = localValues[key] === '1' ? '0' : '1'
}

// 类型 → 徽章颜色
function typeColor(type: string) {
  return ({ secret: 'error', boolean: 'info', number: 'success', text: 'neutral', json: 'secondary' } as Record<string, any>)[type] || 'neutral'
}

// ── 客户端配置：新增弹窗 ──
const clientModal = reactive({
  show: false,
  key: '',
  label: '',
  value: '',
  type: 'text',
  description: '',
  saving: false,
})

function openClientModal() {
  Object.assign(clientModal, { show: true, key: '', label: '', value: '', type: 'text', description: '', saving: false })
}

async function createClient() {
  clientModal.saving = true
  try {
    await $fetch('/api/admin/settings', {
      method: 'PUT',
      body: {
        create: {
          key: clientModal.key.trim(),
          value: clientModal.value,
          label: clientModal.label.trim(),
          description: clientModal.description,
          type: clientModal.type,
          group_name: 'client',
          sort_order: 99,
        },
      },
    })
    toast.add({ title: '创建成功', color: 'success' })
    clientModal.show = false
    await loadSettings()
  } catch (e: any) {
    toast.add({ title: '创建失败', description: e?.data?.message, color: 'error' })
  } finally {
    clientModal.saving = false
  }
}

async function deleteClient(item: any) {
  if (!confirm(`确认删除配置「${item.label}」(${item.key})？`)) return
  try {
    await $fetch(`/api/admin/settings?key=${encodeURIComponent(item.key)}`, { method: 'DELETE' })
    toast.add({ title: '删除成功', color: 'success' })
    await loadSettings()
  } catch (e: any) {
    toast.add({ title: '删除失败', description: e?.data?.message, color: 'error' })
  }
}

// 加载设置
async function loadSettings() {
  try {
    const d = await $fetch<any>('/api/admin/settings')
    allItems.value = d.list
    for (const item of d.list) {
      localValues[item.key] = item.value
    }
  } catch {
    toast.add({ title: '加载失败', description: '无法获取系统设置', color: 'error' })
  } finally {
    loading.value = false
  }
}

onMounted(loadSettings)

// 批量保存
async function saveAll() {
  saving.value = true
  try {
    const batch = allItems.value.map(item => ({
      key: item.key,
      value: localValues[item.key] ?? item.value,
    }))
    await $fetch('/api/admin/settings', { method: 'PUT', body: { batch } })
    toast.add({ title: '保存成功', color: 'success' })
  } catch {
    toast.add({ title: '保存失败', color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>
