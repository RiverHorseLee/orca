import type {
  CustomUsageMetric,
  CustomUsageState,
  CustomUsageError
} from '../../../../shared/custom-usage-contract'
import {
  getDisplayedUsagePercentage,
  type UsagePercentageDisplay
} from '../../../../shared/usage-percentage-display'
import { translate } from '@/i18n/i18n'

const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 })
export function customUsageMetricLabel(metric: CustomUsageMetric): string {
  if (metric.kind === 'percentage') {
    return `${numberFormat.format(metric.usedPercent)}%`
  }
  if (metric.kind === 'quota') {
    const used = numberFormat.format(metric.used)
    const limit = numberFormat.format(metric.limit)
    return metric.unit === 'CNY' ? `￥${used} / ￥${limit}` : `${used} / ${limit} ${metric.unit}`
  }
  const value = numberFormat.format(metric.value)
  return metric.unit === 'CNY' ? `￥${value}` : `${value} ${metric.unit}`
}
export function customUsagePercent(metric: CustomUsageMetric): number | undefined {
  if (metric.kind === 'amount') {
    return undefined
  }
  return metric.kind === 'percentage'
    ? metric.usedPercent
    : Math.min(100, (metric.used / metric.limit) * 100)
}
export function customUsageProgress(
  metric: CustomUsageMetric,
  display: UsagePercentageDisplay = 'used'
): number | undefined {
  const percent = customUsagePercent(metric)
  return percent === undefined ? undefined : getDisplayedUsagePercentage(percent, display)
}
export function customUsageSummary(
  metric: CustomUsageMetric,
  display: UsagePercentageDisplay
): string {
  const shown = customUsageProgress(metric, display)
  if (shown === undefined) {
    return customUsageMetricLabel(metric)
  }
  return translate(
    display === 'remaining' ? 'fork.customUsage.percentLeft' : 'fork.customUsage.percentUsed',
    display === 'remaining' ? '{{value}}% left' : '{{value}}% used',
    { value: shown }
  )
}
export function customUsageErrorLabel(error: CustomUsageError): string {
  switch (error) {
    case 'configuration':
      return translate(
        'fork.customUsage.configuration',
        'Check the Custom configuration in AI Provider Accounts.'
      )
    case 'untrusted':
      return translate(
        'fork.customUsage.untrusted',
        'Confirm that you trust this script before running it.'
      )
    case 'interpreter':
      return translate(
        'fork.customUsage.interpreter',
        'The Python interpreter could not be started. Check its absolute path.'
      )
    case 'script':
      return translate(
        'fork.customUsage.script',
        'The usage script failed. Check the selected script and its dependencies.'
      )
    case 'timeout':
      return translate('fork.customUsage.timeout', 'The usage script timed out.')
    case 'cancelled':
      return translate('fork.customUsage.cancelled', 'The usage test was cancelled.')
    case 'busy':
      return translate('fork.customUsage.busy', 'Another settings operation is still running.')
    case 'invalid-response':
      return translate(
        'fork.customUsage.invalid',
        'The script must output one valid JSON snapshot, with logs on stderr.'
      )
    case 'clock':
      return translate('fork.customUsage.clock', 'The script timestamp is ahead of this computer.')
    case 'rate-limited':
      return translate('fork.customUsage.limited', 'Waiting before retrying.')
    case 'network':
      return translate(
        'fork.customUsage.unavailable',
        'Custom usage is unavailable on this client.'
      )
  }
}
export function customUsageStatusLabel(state: CustomUsageState): string {
  if (state.status === 'stale') {
    return translate('fork.customUsage.stale', 'Out of date')
  }
  if (state.status === 'loading') {
    return translate('fork.customUsage.loading', 'Loading usage')
  }
  if (state.error) {
    return customUsageErrorLabel(state.error)
  }
  return translate('fork.customUsage.used', 'Used')
}
