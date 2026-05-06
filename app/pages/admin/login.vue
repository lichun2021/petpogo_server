<template>
  <div class="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-100">

    <!-- 背景光晕 -->
    <div class="absolute inset-0 pointer-events-none">
      <div class="absolute -top-40 -right-40 w-96 h-96 bg-amber-300/30 rounded-full blur-3xl" />
      <div class="absolute -bottom-40 -left-40 w-96 h-96 bg-orange-200/40 rounded-full blur-3xl" />
      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-yellow-100/50 rounded-full blur-2xl" />
    </div>

    <div class="relative w-full max-w-sm px-6">
      <!-- Logo -->
      <div class="text-center mb-10">
        <div class="inline-flex items-center justify-center w-16 h-16 mb-5 rounded-2xl shadow-2xl shadow-amber-500/30"
          style="background: linear-gradient(135deg, #f59e0b, #ea580c)">
          <span class="text-3xl">🐾</span>
        </div>
        <h1 class="text-2xl font-bold text-gray-700 tracking-tight">萌宠帮管理后台</h1>
        <p class="text-sm text-gray-500 mt-1.5">使用管理员账号登录</p>
      </div>

      <!-- 登录卡片 -->
      <div class="rounded-2xl border border-orange-100 shadow-xl shadow-orange-100/50 p-7 space-y-5 bg-white/80 backdrop-blur-sm">

        <!-- 账号 -->
        <div class="space-y-1.5">
          <label class="block text-xs font-medium text-gray-500 uppercase tracking-wider">管理员账号</label>
          <div class="relative">
            <span class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <UIcon name="i-heroicons-user" class="w-4 h-4 text-gray-500" />
            </span>
            <input
              v-model="form.username"
              type="text"
              placeholder="请输入账号"
              class="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm text-gray-800 placeholder-gray-400 border border-orange-200 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all bg-white"
              @keyup.enter="login"
            />
          </div>
        </div>

        <!-- 密码 -->
        <div class="space-y-1.5">
          <label class="block text-xs font-medium text-gray-500 uppercase tracking-wider">登录密码</label>
          <div class="relative">
            <span class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <UIcon name="i-heroicons-lock-closed" class="w-4 h-4 text-gray-500" />
            </span>
            <input
              v-model="form.password"
              :type="showPwd ? 'text' : 'password'"
              placeholder="请输入密码"
              class="w-full pl-9 pr-10 py-2.5 rounded-lg text-sm text-gray-800 placeholder-gray-400 border border-orange-200 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all bg-white"
              @keyup.enter="login"
            />
            <button
              class="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
              @click="showPwd = !showPwd"
            >
              <UIcon :name="showPwd ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'" class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- 错误提示 -->
        <p v-if="errorMsg" class="text-xs text-red-500 flex items-center gap-1.5">
          <UIcon name="i-heroicons-exclamation-circle" class="w-4 h-4 flex-shrink-0" />
          {{ errorMsg }}
        </p>

        <!-- 登录按钮 -->
        <button
          class="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all relative overflow-hidden"
          :class="loading ? 'opacity-70 cursor-not-allowed' : 'hover:shadow-lg hover:shadow-amber-500/20 active:scale-[0.98]'"
          style="background: linear-gradient(135deg, #f59e0b, #ea580c)"
          :disabled="loading"
          @click="login"
        >
          <span v-if="!loading">登 录</span>
          <span v-else class="flex items-center justify-center gap-2">
            <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
            登录中…
          </span>
        </button>
      </div>

      <p class="text-center text-xs text-gray-400 mt-8">PetPogo 宠物管理平台 © 2026</p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const form     = reactive({ username: '', password: '' })
const loading  = ref(false)
const showPwd  = ref(false)
const errorMsg = ref('')

async function login() {
  if (!form.username || !form.password) { errorMsg.value = '请输入账号和密码'; return }
  loading.value = true; errorMsg.value = ''
  try {
    const res: any = await $fetch('/api/admin/login', {
      method: 'POST', body: { username: form.username, password: form.password }
    })
    localStorage.setItem('admin_token', res.token)
    await navigateTo('/admin')
  } catch (e: any) {
    errorMsg.value = e.data?.message || '登录失败，请重试'
  } finally { loading.value = false }
}
</script>
