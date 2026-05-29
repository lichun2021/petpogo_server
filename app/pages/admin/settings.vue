<template>
  <div class="space-y-5">

    <!-- 页头 -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-base font-semibold text-stone-800">系统设置</h2>
        <p class="text-xs text-stone-400 mt-0.5">管理全局系统配置参数</p>
      </div>
      <UButton
        label="保存全部"
        color="amber"
        icon="i-heroicons-check"
        :loading="saving"
        @click="saveAll"
      />
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="flex justify-center py-16">
      <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 text-stone-400 animate-spin" />
    </div>

    <template v-else>

      <!-- SMS 短信网关 -->
      <div
        class="bg-white rounded-2xl border overflow-hidden"
        style="border-color: #f0e6d8; box-shadow: 0 1px 4px rgba(0,0,0,0.04)"
      >
        <!-- 分组标题 -->
        <div class="flex items-center gap-2.5 px-5 py-3.5 border-b" style="border-color: #f0e6d8; background: #fffbf5">
          <div class="w-7 h-7 rounded-lg flex items-center justify-center" style="background: #fef3c7">
            <UIcon name="i-heroicons-chat-bubble-left-ellipsis" class="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <p class="text-sm font-semibold text-stone-800">短信网关</p>
            <p class="text-[11px] text-stone-400">控制短信验证码发送行为</p>
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
                <p class="text-xs text-stone-400 mt-0.5">{{ item.description }}</p>
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
        class="bg-white rounded-2xl border overflow-hidden"
        style="border-color: #f0e6d8; box-shadow: 0 1px 4px rgba(0,0,0,0.04)"
      >
        <div class="flex items-center gap-2.5 px-5 py-3.5 border-b" style="border-color: #f0e6d8; background: #fffbf5">
          <div class="w-7 h-7 rounded-lg flex items-center justify-center" style="background: #dbeafe">
            <UIcon name="i-heroicons-cog-6-tooth" class="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p class="text-sm font-semibold text-stone-800">通用设置</p>
            <p class="text-[11px] text-stone-400">基础应用参数配置</p>
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
              <p class="text-xs text-stone-400 mt-0.5">{{ item.description }}</p>
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
        class="bg-white rounded-2xl border overflow-hidden"
        style="border-color: #f0e6d8; box-shadow: 0 1px 4px rgba(0,0,0,0.04)"
      >
        <div class="flex items-center gap-2.5 px-5 py-3.5 border-b" style="border-color: #f0e6d8; background: #fffbf5">
          <div class="w-7 h-7 rounded-lg flex items-center justify-center" style="background: #dcfce7">
            <UIcon name="i-heroicons-cloud" class="w-4 h-4 text-green-600" />
          </div>
          <div>
            <p class="text-sm font-semibold text-stone-800">OSS / 存储</p>
            <p class="text-[11px] text-stone-400">对象存储相关配置</p>
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
              <p class="text-xs text-stone-400 mt-0.5">{{ item.description }}</p>
            </div>
            <div class="w-80 flex-shrink-0">
              <UInput v-model="localValues[item.key]" size="sm" />
            </div>
          </div>
        </div>
      </div>

    </template>

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

// 加载设置
onMounted(async () => {
  try {
    const d = await $fetch<any>('/api/admin/settings')
    allItems.value = d.list
    for (const item of d.list) {
      localValues[item.key] = item.value
    }
  } catch {
    toast.add({ title: '加载失败', description: '无法获取系统设置', color: 'red' })
  } finally {
    loading.value = false
  }
})

// 批量保存
async function saveAll() {
  saving.value = true
  try {
    const batch = allItems.value.map(item => ({
      key: item.key,
      value: localValues[item.key] ?? item.value,
    }))
    await $fetch('/api/admin/settings', { method: 'PUT', body: { batch } })
    toast.add({ title: '保存成功', color: 'green' })
  } catch {
    toast.add({ title: '保存失败', color: 'red' })
  } finally {
    saving.value = false
  }
}
</script>
