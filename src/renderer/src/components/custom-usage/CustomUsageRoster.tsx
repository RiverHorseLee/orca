import { ChartNoAxesCombined, ChevronRight, TriangleAlert } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import type { CustomUsageState } from '../../../../shared/custom-usage-contract'
import type { UsagePercentageDisplay } from '../../../../shared/usage-percentage-display'
import type { StatusBarUsageMode } from '../../../../shared/status-bar-usage-mode'
import { MiniBar } from '../status-bar/StatusBarProviderSegment'
import {
  customUsageMetricLabel,
  customUsagePercent,
  customUsageProgress,
  customUsageSummary,
  customUsageStatusLabel,
  customUsageErrorLabel
} from './custom-usage-display'

export const CUSTOM_USAGE_CHIP_ID = 'custom-usage'
export function customUsageName(state: CustomUsageState): string {
  return state.label ?? translate('fork.customUsage.custom', 'Custom')
}
export function customUsageUrgent(state: CustomUsageState): boolean {
  return (
    state.status === 'stale' ||
    state.error !== null ||
    (state.snapshot?.metrics.some((metric) => (customUsagePercent(metric) ?? 0) >= 80) ?? false)
  )
}
export function CustomUsageChip({
  state,
  display,
  compact,
  mode,
  collapsed
}: {
  state: CustomUsageState
  display: UsagePercentageDisplay
  compact: boolean
  mode: StatusBarUsageMode
  collapsed: boolean
}): React.JSX.Element {
  const metric = state.snapshot?.metrics[0]
  const percent = metric ? customUsagePercent(metric) : undefined
  const summary = metric ? customUsageSummary(metric, display) : customUsageStatusLabel(state)
  return (
    <span
      data-usage-chip={CUSTOM_USAGE_CHIP_ID}
      data-usage-urgent={customUsageUrgent(state)}
      data-usage-collapsed={collapsed}
      aria-hidden={collapsed}
      className="inline-flex items-center gap-1.5 data-[usage-collapsed=true]:invisible data-[usage-collapsed=true]:absolute"
    >
      {state.error || state.status === 'stale' ? (
        <TriangleAlert size={12} />
      ) : (
        <ChartNoAxesCombined size={12} />
      )}
      <span className="max-w-24 truncate">{customUsageName(state)}</span>
      {mode === 'verbose' && !compact && percent !== undefined ? (
        <MiniBar usedPct={percent} display={display} />
      ) : null}
      <span
        className="max-w-40 truncate tabular-nums"
        aria-label={`${customUsageName(state)} · ${summary}`}
      >
        {summary}
      </span>
    </span>
  )
}
export function CustomUsageMetrics({
  state,
  display = 'used'
}: {
  state: CustomUsageState
  display?: UsagePercentageDisplay
}): React.JSX.Element {
  return (
    <div className="space-y-2">
      {state.snapshot?.metrics.map((metric) => {
        const progress = customUsageProgress(metric, display)
        return (
          <div key={metric.id} className="space-y-1">
            <div className="flex justify-between gap-3 text-xs">
              <span className="min-w-0 break-words">{metric.label}</span>
              <span className="min-w-0 break-words text-right tabular-nums">
                {metric.kind === 'percentage'
                  ? customUsageSummary(metric, display)
                  : customUsageMetricLabel(metric)}
              </span>
            </div>
            {progress !== undefined ? (
              <Progress
                value={progress}
                aria-label={metric.label}
                aria-valuetext={customUsageSummary(metric, display)}
              />
            ) : null}
            {metric.kind === 'quota' && display === 'remaining' ? (
              <p className="text-xs text-muted-foreground">{customUsageSummary(metric, display)}</p>
            ) : null}
            {metric.resetsAt ? (
              <p className="text-xs text-muted-foreground">
                {translate('fork.customUsage.resets', 'Resets')}:{' '}
                {new Date(metric.resetsAt).toLocaleString()}
              </p>
            ) : null}
          </div>
        )
      })}
      {state.snapshot?.metrics.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {translate('fork.customUsage.empty', 'No metrics reported.')}
        </p>
      ) : null}
    </div>
  )
}
export function CustomUsageRosterRow({
  state,
  display,
  mode,
  onConfigure
}: {
  state: CustomUsageState
  display: UsagePercentageDisplay
  mode: StatusBarUsageMode
  onConfigure: () => void
}): React.JSX.Element {
  const first = state.snapshot?.metrics[0]
  return (
    <div className="space-y-2 border-t border-border px-3.5 py-2.5" data-custom-usage-row>
      <DropdownMenuItem onSelect={onConfigure}>
        <ChartNoAxesCombined size={14} />
        <span className="min-w-0 flex-1 truncate">{customUsageName(state)}</span>
        <ChevronRight size={14} />
      </DropdownMenuItem>
      <p className="text-xs text-muted-foreground">
        {translate('fork.customUsage.scope', 'This computer · Account-wide')}
      </p>
      {state.status === 'stale' || state.error || !state.snapshot ? (
        <p role="status" className="text-xs text-muted-foreground">
          {customUsageStatusLabel(state)}
          {state.status === 'stale' && state.error
            ? ` · ${customUsageErrorLabel(state.error)}`
            : ''}
        </p>
      ) : null}
      {mode === 'verbose' ? (
        <CustomUsageMetrics state={state} display={display} />
      ) : first ? (
        <p className="text-xs tabular-nums">
          {first.label} · {customUsageSummary(first, display)}
        </p>
      ) : null}
      {state.snapshot ? (
        <p className="text-xs text-muted-foreground">
          {translate('fork.customUsage.updated', 'Observed')}:{' '}
          {new Date(state.snapshot.observedAt).toLocaleString()}
        </p>
      ) : null}
    </div>
  )
}
