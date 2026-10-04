import { describe, expect, it, vi } from 'vitest'
import { getAccountsPaneSearchEntries as getBuiltinAccountsSearchEntries } from '../settings/accounts-search'
import { matchesSettingsSearch } from '../settings/settings-search'
import {
  getAccountsPaneSearchEntries,
  getCustomUsageSearchEntries
} from './custom-usage-settings-search'

vi.mock('@/i18n/i18n', () => ({
  i18n: { language: 'en' },
  translate: (_key: string, fallback: string) => fallback
}))

describe('custom account search composition', () => {
  it('preserves builtin search entries and adds the custom settings target', () => {
    expect(getAccountsPaneSearchEntries()).toEqual([
      ...getBuiltinAccountsSearchEntries(),
      ...getCustomUsageSearchEntries()
    ])
    expect(getAccountsPaneSearchEntries()).toContainEqual(
      expect.objectContaining({ targetSectionId: 'accounts-custom' })
    )
  })
  it.each(['Python', 'custom', '自定义', '用量'])('finds the custom section with %s', (query) => {
    expect(matchesSettingsSearch(query, getCustomUsageSearchEntries())).toBe(true)
  })
})
