import { getAccountsPaneSearchEntries as getBuiltinAccountsSearchEntries } from '../settings/accounts-search'
import { createLocalizedCatalog } from '@/i18n/localized-catalog'
import type { SettingsSearchEntry } from '../settings/settings-search'
import { translate } from '@/i18n/i18n'
export function getCustomUsageSearchEntries(): SettingsSearchEntry[] {
  return [
    {
      title: translate('fork.customUsage.custom', 'Custom'),
      description: translate(
        'fork.customUsage.settingsDescription',
        'Read account usage from a Python script on this computer.'
      ),
      keywords: [
        'custom',
        'python',
        'usage',
        'quota',
        'script',
        'interpreter',
        '自定义',
        '用量',
        '脚本'
      ],
      targetSectionId: 'accounts-custom'
    }
  ]
}

export const getAccountsPaneSearchEntries = createLocalizedCatalog((): SettingsSearchEntry[] => [
  ...getBuiltinAccountsSearchEntries(),
  ...getCustomUsageSearchEntries()
])
