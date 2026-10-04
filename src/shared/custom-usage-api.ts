import type { CustomUsageState } from './custom-usage-contract'
import type {
  CustomUsageSettings,
  CustomUsageSettingsRead,
  CustomUsageSaveResult,
  CustomUsageTestResult
} from './custom-usage-settings'

export const CUSTOM_USAGE_CHANNELS = {
  read: 'custom-usage:read',
  refresh: 'custom-usage:refresh',
  subscribe: 'custom-usage:subscribe',
  unsubscribe: 'custom-usage:unsubscribe',
  changed: 'custom-usage:changed',
  settings: 'custom-usage:settings',
  save: 'custom-usage:save',
  test: 'custom-usage:test',
  cancelTest: 'custom-usage:cancel-test',
  choosePath: 'custom-usage:choose-path'
} as const
export type CustomUsageApi = {
  transport: 'desktop-local-v1'
  read: () => Promise<CustomUsageState>
  refresh: () => Promise<void>
  subscribe: (listener: (state: CustomUsageState) => void) => () => void
  getSettings: () => Promise<CustomUsageSettingsRead>
  saveSettings: (settings: CustomUsageSettings) => Promise<CustomUsageSaveResult>
  test: (settings: CustomUsageSettings) => Promise<CustomUsageTestResult>
  cancelTest: () => void
  choosePath: (kind: 'python' | 'script') => Promise<string | null>
}
export function isCustomUsageApi(value: unknown): value is CustomUsageApi {
  return (
    typeof value === 'object' &&
    value !== null &&
    'transport' in value &&
    value.transport === 'desktop-local-v1' &&
    'read' in value &&
    typeof value.read === 'function' &&
    'refresh' in value &&
    typeof value.refresh === 'function' &&
    'subscribe' in value &&
    typeof value.subscribe === 'function' &&
    'getSettings' in value &&
    typeof value.getSettings === 'function' &&
    'saveSettings' in value &&
    typeof value.saveSettings === 'function' &&
    'test' in value &&
    typeof value.test === 'function' &&
    'cancelTest' in value &&
    typeof value.cancelTest === 'function' &&
    'choosePath' in value &&
    typeof value.choosePath === 'function'
  )
}
