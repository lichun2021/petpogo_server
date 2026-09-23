export default defineAppConfig({
  ui: {
    colors: { primary: 'orange', secondary: 'violet', neutral: 'stone' },
    button: {
      slots: { base: 'rounded-lg cursor-pointer justify-center' },
      variants: { size: {
        xs: { base: 'min-h-7 px-2 text-xs' },
        sm: { base: 'min-h-8 px-3 text-sm' },
        md: { base: 'min-h-9 px-3.5 text-sm' },
      } },
    },
    input: { slots: { root: 'w-full', base: 'rounded-lg' }, variants: { size: { sm: { base: 'min-h-9 text-sm' }, md: { base: 'min-h-9 text-sm' } } } },
    textarea: { slots: { root: 'w-full', base: 'rounded-lg text-sm' } },
    selectMenu: { slots: { base: 'min-h-9 rounded-lg text-sm' } },
    modal: { slots: { overlay: 'bg-stone-950/25', content: 'bg-white rounded-2xl', title: 'text-base font-semibold', header: 'border-b border-stone-100', footer: 'border-t border-stone-100' } },
    slideover: { slots: { overlay: 'bg-stone-950/25', content: 'bg-white', header: 'border-b border-stone-200', footer: 'border-t border-stone-200' } },
    // 密度影响内边距，不再把分类、状态等文字缩到8/10px。
    badge: {
      variants: {
        size: {
          xs: { base: 'text-xs leading-5 px-1.5 py-0.5' },
          sm: { base: 'text-xs leading-5 px-2 py-0.5' },
          md: { base: 'text-xs leading-5 px-2 py-1' },
          lg: { base: 'text-sm leading-5 px-2.5 py-1' },
          xl: { base: 'text-base leading-6 px-3 py-1' },
        },
      },
    },
  },
})
