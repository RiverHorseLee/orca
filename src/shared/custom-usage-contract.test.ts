import { describe, expect, it } from 'vitest'
import { customUsageSnapshotSchema } from './custom-usage-contract'
import { customUsageFixture } from './custom-usage-test-fixture'

describe('custom usage snapshot contract', () => {
  it('accepts all three metrics and strips unknown extension fields', () => {
    expect(
      customUsageSnapshotSchema.parse({ ...customUsageFixture(), future: true })
    ).not.toHaveProperty('future')
  })
  it.each([0, 100, 125])('preserves consumed percentage %s without guessing units', (value) => {
    const snapshot = {
      ...customUsageFixture(),
      metrics: [{ id: 'x', label: 'Percent', kind: 'percentage', usedPercent: value }]
    }
    expect(customUsageSnapshotSchema.parse(snapshot).metrics).toEqual(snapshot.metrics)
  })
  it('accepts empty metrics, over-budget quotas and negative balances', () => {
    expect(
      customUsageSnapshotSchema.safeParse({ ...customUsageFixture(), metrics: [] }).success
    ).toBe(true)
    for (const metric of [
      { id: 'x', label: 'Quota', kind: 'quota', used: 120, limit: 100, unit: 'USD' },
      { id: 'x', label: 'Balance', kind: 'amount', value: -2, unit: 'USD' }
    ]) {
      expect(
        customUsageSnapshotSchema.safeParse({ ...customUsageFixture(), metrics: [metric] }).success
      ).toBe(true)
    }
  })
  it.each([-1, Number.NaN, Infinity, '25', Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid percentage %s',
    (usedPercent) => {
      expect(
        customUsageSnapshotSchema.safeParse({
          ...customUsageFixture(),
          metrics: [{ id: 'x', label: 'x', kind: 'percentage', usedPercent }]
        }).success
      ).toBe(false)
    }
  )
  it.each([0, -1, Number.NaN, Infinity])('rejects invalid quota limit %s', (limit) => {
    expect(
      customUsageSnapshotSchema.safeParse({
        ...customUsageFixture(),
        metrics: [{ id: 'x', label: 'x', kind: 'quota', used: 10, limit, unit: 'USD' }]
      }).success
    ).toBe(false)
  })
  it('rejects duplicate identities, large lists and invalid schema/time', () => {
    const fixture = customUsageFixture()
    for (const extra of [
      { metrics: [fixture.metrics[0], fixture.metrics[0]] },
      {
        metrics: Array.from({ length: 33 }, (_, index) => ({
          id: `x${index}`,
          label: 'x',
          kind: 'amount',
          value: 1,
          unit: 'x'
        }))
      },
      { schemaVersion: 2 },
      { observedAt: 'yesterday' },
      { observedAt: '2026-02-30T00:00:00Z' },
      { observedAt: '2026-10-04T00:00:00' },
      { source: { id: 'x', label: '', scope: 'account' } }
    ]) {
      expect(customUsageSnapshotSchema.safeParse({ ...fixture, ...extra }).success).toBe(false)
    }
  })
})
