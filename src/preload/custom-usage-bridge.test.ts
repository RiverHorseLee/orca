// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CUSTOM_USAGE_CHANNELS, isCustomUsageApi } from '../shared/custom-usage-api'
import { disabledCustomUsageState } from '../shared/custom-usage-contract'
import { installCustomUsageBridge } from './custom-usage-bridge'

const electron = vi.hoisted(() => ({
  exposeInMainWorld: vi.fn(),
  invoke: vi.fn(async () => {}),
  on: vi.fn(),
  removeListener: vi.fn(),
  send: vi.fn()
}))
vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: electron.exposeInMainWorld },
  ipcRenderer: electron
}))
afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('non-routable desktop custom usage bridge', () => {
  it('is exposed separately from window.api and reference-counts listeners', async () => {
    vi.stubGlobal('process', { ...process, isMainFrame: true, contextIsolated: true })
    installCustomUsageBridge()
    const [name, api] = electron.exposeInMainWorld.mock.calls[0] ?? []
    expect(name).toBe('orcaCustomUsage')
    if (!isCustomUsageApi(api)) {
      throw new Error('Missing typed local bridge')
    }
    const first = vi.fn()
    const second = vi.fn()
    const releaseFirst = api.subscribe(first)
    const releaseSecond = api.subscribe(second)
    expect(electron.invoke).toHaveBeenCalledTimes(1)
    expect(electron.invoke).toHaveBeenCalledWith(CUSTOM_USAGE_CHANNELS.subscribe)
    const callback: unknown = electron.on.mock.calls[0]?.[1]
    if (typeof callback !== 'function') {
      throw new Error('Missing subscription callback')
    }
    callback({}, disabledCustomUsageState())
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
    releaseFirst()
    expect(electron.send).not.toHaveBeenCalled()
    releaseSecond()
    expect(electron.send).toHaveBeenCalledWith(CUSTOM_USAGE_CHANNELS.unsubscribe)
    expect(electron.removeListener).toHaveBeenCalledTimes(1)
  })
  it('does not expose the bridge to subframes', () => {
    vi.stubGlobal('process', { ...process, isMainFrame: false })
    installCustomUsageBridge()
    expect(electron.exposeInMainWorld).not.toHaveBeenCalled()
  })
  it('ignores a retired subscription failure and makes cleanup idempotent', async () => {
    vi.stubGlobal('process', { ...process, isMainFrame: true, contextIsolated: true })
    let rejectFirst: (error: Error) => void = () => {}
    electron.invoke.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectFirst = reject
        })
    )
    installCustomUsageBridge()
    const api: unknown = electron.exposeInMainWorld.mock.calls[0]?.[1]
    if (!isCustomUsageApi(api)) {
      throw new Error('Missing local bridge')
    }
    const first = api.subscribe(vi.fn())
    first()
    first()
    const listener = vi.fn()
    const second = api.subscribe(listener)
    rejectFirst(new Error('retired request'))
    await Promise.resolve()
    expect(listener).not.toHaveBeenCalled()
    expect(electron.send).toHaveBeenCalledTimes(1)
    second()
  })
})
