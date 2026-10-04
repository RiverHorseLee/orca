import type { CustomUsageSnapshot } from './custom-usage-contract'

export function customUsageFixture(observedAt = new Date().toISOString()): CustomUsageSnapshot {
  return {
    schemaVersion: 1,
    source: { id: 'sample', label: 'Sample account', scope: 'account' },
    observedAt,
    metrics: [
      { id: 'budget', label: 'Monthly', kind: 'quota', used: 42.5, limit: 100, unit: 'USD' },
      { id: 'window', label: 'Window', kind: 'percentage', usedPercent: 35 },
      { id: 'count', label: 'Total', kind: 'amount', value: 123456, unit: 'tokens' }
    ]
  }
}
