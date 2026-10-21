<template>
  <UModal :open="open" :title="title" :content="{ 'aria-describedby': undefined }" :dismissible="!busy" :close="{ disabled: busy }" :ui="{ content: modalWidth[size] + ' rounded-2xl', body: 'p-5 sm:p-6', footer: 'justify-end gap-2' }" @update:open="setOpen">
    <template #body><fieldset :disabled="busy" class="admin-form-fields min-w-0 space-y-4"><slot /></fieldset></template>
    <template #footer><fieldset :disabled="busy" class="contents"><slot name="footer" /></fieldset></template>
  </UModal>
</template>
<script setup lang="ts">
const props = withDefaults(defineProps<{ open: boolean; title: string; busy?: boolean; size?: 'sm' | 'md' | 'lg' }>(), { busy: false, size: 'sm' })
const modalWidth = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl' }
const emit = defineEmits<{ 'update:open': [value: boolean] }>()
function setOpen(value: boolean) { if (!props.busy) emit('update:open', value) }
</script>
