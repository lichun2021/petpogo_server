<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
// 强制浅色模式
const colorMode = useColorMode()
colorMode.preference = 'light'
</script>
