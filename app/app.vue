<template>
  <UApp :locale="zh_cn">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>

<script setup lang="ts">
import { zh_cn } from '@nuxt/ui/locale'
// 强制浅色模式
const colorMode = useColorMode()
colorMode.preference = 'light'
</script>
