<template>
  <UModal :open="open" :title="title" :content="{ 'aria-describedby': undefined }" :dismissible="!busy" :close="{ disabled: busy }" :ui="{ content: 'max-w-md rounded-2xl', body: 'p-5 sm:p-6', footer: 'justify-end gap-2' }" @update:open="setOpen">
    <template #body><fieldset :disabled="busy" class="admin-form-fields min-w-0 space-y-4"><slot /></fieldset></template>
    <template #footer><fieldset :disabled="busy" class="contents"><slot name="footer" /></fieldset></template>
  </UModal>
</template>
<script setup lang="ts">
const props = withDefaults(defineProps<{ open: boolean; title: string; busy?: boolean }>(), { busy: false })
const emit = defineEmits<{ 'update:open': [value: boolean] }>()
function setOpen(value: boolean) { if (!props.busy) emit('update:open', value) }
</script>
