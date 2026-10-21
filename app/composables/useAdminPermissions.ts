export function useAdminPermissions() {
  const role = useState<string>('admin-current-role', () => '')
  onMounted(() => { role.value = localStorage.getItem('admin_role') || '' })
  return { canManageSystem: computed(() => role.value === 'super_admin') }
}
