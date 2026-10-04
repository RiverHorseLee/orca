import { useAppStore } from '../../store'

export function openCustomUsageSettings(): void {
  const store = useAppStore.getState()
  store.openSettingsTarget({ pane: 'accounts', repoId: null, sectionId: 'accounts-custom' })
  store.openSettingsPage()
}
