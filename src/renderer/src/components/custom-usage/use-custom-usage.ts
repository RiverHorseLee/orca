import { useEffect, useState } from 'react'
import type { CustomUsageState } from '../../../../shared/custom-usage-contract'
import { isCustomUsageApi, type CustomUsageApi } from '../../../../shared/custom-usage-api'
import { isPairedWebClientWindow } from '@/lib/desktop-window-chrome'

const unavailableState: CustomUsageState = {
  status: 'error',
  snapshot: null,
  error: 'network',
  isRefreshing: false,
  nextRefreshAt: null,
  staleAt: null
}
export function getCustomUsageApi(): CustomUsageApi | undefined {
  if (typeof window === 'undefined' || isPairedWebClientWindow()) {
    return undefined
  }
  const api = 'orcaCustomUsage' in window ? window.orcaCustomUsage : undefined
  return isCustomUsageApi(api) ? api : undefined
}
function observeCustomUsage(onState: (state: CustomUsageState) => void): () => void {
  const api = getCustomUsageApi()
  let active = true
  let receivedPush = false
  const unsubscribe = api?.subscribe((next) => {
    if (active) {
      receivedPush = true
      onState(next)
    }
  })
  void api
    ?.read()
    .then((initial) => {
      if (active && !receivedPush) {
        onState(initial)
      }
    })
    .catch(() => {
      if (active && !receivedPush) {
        onState(unavailableState)
      }
    })
  return () => {
    active = false
    unsubscribe?.()
  }
}
export function useCustomUsage(active = true): {
  state: CustomUsageState | null
  refresh: () => Promise<void>
} {
  const [state, setState] = useState<CustomUsageState | null>(null)
  useEffect(() => (active ? observeCustomUsage(setState) : undefined), [active])
  const refresh = async (): Promise<void> => {
    try {
      await getCustomUsageApi()?.refresh()
    } catch {
      setState((current) =>
        current
          ? {
              ...current,
              status: current.snapshot ? 'stale' : 'error',
              error: 'network',
              isRefreshing: false
            }
          : unavailableState
      )
    }
  }
  return { state: active ? state : null, refresh }
}
