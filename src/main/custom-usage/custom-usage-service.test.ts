import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { customUsageFixture } from '../../shared/custom-usage-test-fixture'
import type { CustomUsageSnapshot, CustomUsageState } from '../../shared/custom-usage-contract'
import type { CustomUsageConfiguration } from './custom-usage-config'
import { CustomUsageFetchError } from './custom-usage-failure'
import { CustomUsageService } from './custom-usage-service'

const config = {
  enabled: true,
  trusted: true,
  name: 'Custom',
  pythonPath: '/test/python',
  scriptPath: '/test/usage.py',
  pollSeconds: 60,
  timeoutMs: 1000,
  staleAfterSeconds: 180
} as const
const enabled = (): CustomUsageConfiguration => ({ kind: 'enabled', config })
const services: CustomUsageService[] = []
function setup(
  readConfiguration = vi.fn(async (): Promise<CustomUsageConfiguration> => enabled())
) {
  const fetch = vi.fn(async (_config: unknown, _signal: AbortSignal) => customUsageFixture())
  const service = new CustomUsageService({ readConfiguration, fetch, random: () => 0 })
  services.push(service)
  return { service, fetch, readConfiguration }
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-04T08:00:00Z'))
})
afterEach(() => {
  for (const service of services.splice(0)) {
    service.dispose()
  }
  vi.useRealTimers()
})

describe('custom usage subscription lifecycle', () => {
  it('owns no network or timers before an enabled subscription', async () => {
    const { service, fetch } = setup(vi.fn(async () => ({ kind: 'disabled' })))
    expect((await service.read()).status).toBe('disabled')
    service.subscribe(() => {})
    await service.refresh()
    expect(fetch).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('coalesces subscribers and refreshes, and respects the next request deadline', async () => {
    const { service, fetch } = setup()
    await service.read()
    service.subscribe(() => {})
    service.subscribe(() => {})
    await Promise.all([service.refresh(), service.refresh()])
    expect(fetch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(60000)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(JSON.stringify(service.getState())).not.toContain(config.pythonPath)
    service.dispose()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('keeps the last successful snapshot stale on failures without changing observedAt', async () => {
    const { service, fetch } = setup()
    await service.read()
    service.subscribe(() => {})
    await service.refresh()
    const snapshot = service.getState().snapshot
    fetch.mockRejectedValue(new CustomUsageFetchError('network'))
    await vi.advanceTimersByTimeAsync(60000)
    expect(service.getState()).toMatchObject({
      status: 'stale',
      snapshot,
      error: 'network',
      isRefreshing: false
    })
  })
  it('expires data on its observation timestamp even before a long poll', async () => {
    const custom = { ...config, pollSeconds: 600, staleAfterSeconds: 15 }
    const { service, fetch } = setup(vi.fn(async () => ({ kind: 'enabled', config: custom })))
    const states: CustomUsageState[] = []
    await service.read()
    service.subscribe((state) => states.push(state))
    await service.refresh()
    await vi.advanceTimersByTimeAsync(15000)
    expect(states.at(-1)?.status).toBe('stale')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('honors Retry-After and prevents manual refresh from bypassing it', async () => {
    const { service, fetch } = setup()
    fetch.mockRejectedValue(new CustomUsageFetchError('rate-limited', 120000))
    await service.read()
    service.subscribe(() => {})
    await service.refresh()
    await vi.advanceTimersByTimeAsync(60000)
    await service.refresh()
    expect(fetch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(60000)
    expect(fetch).toHaveBeenCalledTimes(2)
  })
  it('aborts and ignores late results when the last subscriber leaves', async () => {
    const { service, fetch } = setup()
    let complete: (snapshot: CustomUsageSnapshot) => void = () => {}
    fetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve
        })
    )
    await service.read()
    const release = service.subscribe(() => {})
    const signal = fetch.mock.calls[0]?.[1]
    release()
    expect(signal?.aborted).toBe(true)
    complete(customUsageFixture())
    await Promise.resolve()
    expect(service.getState().snapshot).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('clears old source data and aborts requests when disabled or reconfigured', async () => {
    const { service, fetch, readConfiguration } = setup()
    await service.read()
    service.subscribe(() => {})
    await service.refresh()
    readConfiguration.mockResolvedValue({
      kind: 'enabled',
      config: { ...config, scriptPath: '/test/other.py' }
    })
    await service.reloadConfiguration()
    expect(service.getState().snapshot).toBeNull()
    await service.refresh()
    expect(fetch).toHaveBeenCalledTimes(2)
    readConfiguration.mockResolvedValue({ kind: 'disabled' })
    await service.reloadConfiguration()
    expect(service.getState().status).toBe('disabled')
    expect(service.getState().snapshot).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('does not revive a disposed service after configuration IO resolves', async () => {
    let complete: (configuration: CustomUsageConfiguration) => void = () => {}
    const read = vi.fn(
      () =>
        new Promise<CustomUsageConfiguration>((resolve) => {
          complete = resolve
        })
    )
    const { service, fetch } = setup(read)
    const pending = service.read()
    service.dispose()
    complete(enabled())
    await pending
    service.subscribe(() => {})
    await service.refresh()
    expect(service.getState().status).toBe('disabled')
    expect(fetch).not.toHaveBeenCalled()
  })
  it('publishes stale status when a slow refresh crosses the expiry boundary', async () => {
    const { service, fetch } = setup(
      vi.fn(async () => ({
        kind: 'enabled',
        config: { ...config, pollSeconds: 15, staleAfterSeconds: 20 }
      }))
    )
    const states: CustomUsageState[] = []
    await service.read()
    service.subscribe((state) => states.push(state))
    await service.refresh()
    fetch.mockImplementation(() => new Promise(() => {}))
    await vi.advanceTimersByTimeAsync(15000)
    expect(service.getState().isRefreshing).toBe(true)
    await vi.advanceTimersByTimeAsync(5000)
    expect(states.at(-1)?.status).toBe('stale')
    expect(vi.getTimerCount()).toBe(0)
  })
  it('does not let a retired source overwrite a replacement source', async () => {
    const { service, fetch, readConfiguration } = setup()
    let finishOld: (snapshot: CustomUsageSnapshot) => void = () => {}
    fetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOld = resolve
        })
    )
    await service.read()
    service.subscribe(() => {})
    const oldSignal = fetch.mock.calls[0]?.[1]
    readConfiguration.mockResolvedValue({
      kind: 'enabled',
      config: { ...config, scriptPath: '/test/other.py' }
    })
    await service.reloadConfiguration()
    await service.refresh()
    const replacement = service.getState().snapshot
    expect(oldSignal?.aborted).toBe(true)
    const retired = customUsageFixture()
    retired.source.id = 'retired-account'
    finishOld(retired)
    await Promise.resolve()
    expect(service.getState().snapshot).toBe(replacement)
  })
})
