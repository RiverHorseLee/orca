import { z } from 'zod'

export const CUSTOM_USAGE_MAX_BYTES = 256 * 1024
const identifier = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/)
const timestamp = z.string().datetime({ offset: true })
const finiteValue = z.number().finite().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER)
const metricFields = {
  id: identifier,
  label: z.string().trim().min(1).max(80),
  resetsAt: timestamp.optional()
}
const unit = z.string().trim().min(1).max(16)

export const customUsageSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  source: z.object({
    id: identifier,
    label: z.string().trim().min(1).max(80),
    scope: z.literal('account')
  }),
  observedAt: timestamp,
  refreshAfterSeconds: z.number().int().min(15).max(3600).optional(),
  metrics: z
    .array(
      z.discriminatedUnion('kind', [
        z.object({
          ...metricFields,
          kind: z.literal('percentage'),
          usedPercent: finiteValue.nonnegative()
        }),
        z.object({
          ...metricFields,
          kind: z.literal('quota'),
          used: finiteValue.nonnegative(),
          limit: finiteValue.positive(),
          unit
        }),
        z.object({ ...metricFields, kind: z.literal('amount'), value: finiteValue, unit })
      ])
    )
    .max(32)
    .refine((metrics) => new Set(metrics.map((metric) => metric.id)).size === metrics.length)
})

export type CustomUsageSnapshot = z.infer<typeof customUsageSnapshotSchema>
export type CustomUsageMetric = CustomUsageSnapshot['metrics'][number]
export type CustomUsageError =
  | 'configuration'
  | 'untrusted'
  | 'interpreter'
  | 'script'
  | 'cancelled'
  | 'busy'
  | 'network'
  | 'timeout'
  | 'rate-limited'
  | 'invalid-response'
  | 'clock'
export type CustomUsageState = {
  label?: string
  status: 'disabled' | 'loading' | 'ready' | 'stale' | 'error'
  snapshot: CustomUsageSnapshot | null
  error: CustomUsageError | null
  isRefreshing: boolean
  nextRefreshAt: number | null
  staleAt: number | null
}

export function disabledCustomUsageState(): CustomUsageState {
  return {
    status: 'disabled',
    snapshot: null,
    error: null,
    isRefreshing: false,
    nextRefreshAt: null,
    staleAt: null
  }
}
