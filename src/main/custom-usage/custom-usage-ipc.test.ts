import { EventEmitter } from 'node:events'
import type { IpcMainInvokeEvent } from 'electron'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CUSTOM_USAGE_CHANNELS } from '../../shared/custom-usage-api'
import { customUsageFixture } from '../../shared/custom-usage-test-fixture'
import { defaultCustomUsageSettings } from '../../shared/custom-usage-settings'
import type { CustomUsageConfiguration } from './custom-usage-config'
import { registerCustomUsageHandlers } from './custom-usage-ipc'
import { stopCustomUsage } from './custom-usage-lifecycle'

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (event: IpcMainInvokeEvent, value?: unknown) => unknown>(),
  events: new Map<string, (event: IpcMainInvokeEvent) => void>(),
  quit: (): void => {},
  trusted: true,
  read: vi.fn<() => Promise<CustomUsageConfiguration>>(),
  fetch: vi.fn(),
  settings: vi.fn(),
  save: vi.fn(),
  picker: vi.fn(),
  dispose: vi.fn()
}))
vi.mock('electron', () => ({
  app: {
    once: (_name: string, callback: () => void) => {
      mocks.quit = callback
    }
  },
  BrowserWindow: { fromWebContents: () => ({}) },
  dialog: { showOpenDialog: mocks.picker },
  ipcMain: {
    handle: (name: string, callback: (event: IpcMainInvokeEvent, value?: unknown) => unknown) =>
      mocks.handlers.set(name, callback),
    on: (name: string, callback: (event: IpcMainInvokeEvent) => void) =>
      mocks.events.set(name, callback)
  }
}))
vi.mock('../ipc/browser-renderer-trust', () => ({ isTrustedBrowserRenderer: () => mocks.trusted }))
vi.mock('../persistence/loading-store/user-data-path', () => ({
  getCanonicalUserDataPath: () => '/isolated-test-user-data'
}))
vi.mock('./custom-usage-config', () => ({
  readCustomUsageConfiguration: mocks.read,
  readCustomUsageSettings: mocks.settings,
  saveCustomUsageSettings: mocks.save
}))
vi.mock('./custom-usage-script', () => ({
  CustomUsageScriptRunner: class {
    run = mocks.fetch
    dispose = mocks.dispose
  }
}))
function event() {
  const mainFrame = {}
  const sender = Object.assign(new EventEmitter(), {
    id: 1,
    mainFrame,
    isDestroyed: () => false,
    send: vi.fn()
  })
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: Only sender/frame identity and EventEmitter lifetime methods are accessed; trust is mocked separately.
  return { sender, senderFrame: mainFrame } as unknown as IpcMainInvokeEvent
}
async function invoke(
  channel: string,
  input: IpcMainInvokeEvent,
  value?: unknown
): Promise<unknown> {
  const handler = mocks.handlers.get(channel)
  if (!handler) {
    throw new Error('Missing registered handler')
  }
  return handler(input, value)
}
const config = {
  ...defaultCustomUsageSettings(),
  enabled: true,
  trusted: true,
  pythonPath: '/test/python',
  scriptPath: '/test/usage.py'
}
beforeEach(() => {
  vi.useFakeTimers()
  mocks.trusted = true
  mocks.handlers.clear()
  mocks.events.clear()
  mocks.read.mockReset().mockResolvedValue({ kind: 'enabled', config })
  mocks.fetch.mockReset().mockResolvedValue(customUsageFixture())
  mocks.settings.mockReset().mockResolvedValue({ settings: config, error: null })
  mocks.save.mockReset().mockResolvedValue(config)
  mocks.picker.mockReset().mockResolvedValue({ canceled: true, filePaths: [] })
  mocks.dispose.mockResolvedValue(undefined)
  registerCustomUsageHandlers()
})
afterEach(async () => {
  await stopCustomUsage()
  vi.useRealTimers()
})

describe('desktop custom usage IPC ownership', () => {
  it.each([
    CUSTOM_USAGE_CHANNELS.read,
    CUSTOM_USAGE_CHANNELS.settings,
    CUSTOM_USAGE_CHANNELS.save,
    CUSTOM_USAGE_CHANNELS.test,
    CUSTOM_USAGE_CHANNELS.choosePath
  ])('rejects untrusted windows/subframes for %s', async (channel) => {
    mocks.trusted = false
    await expect(invoke(channel, event(), config)).rejects.toThrow('local desktop main frame')
    mocks.trusted = true
    await expect(invoke(channel, { ...event(), senderFrame: null }, config)).rejects.toThrow(
      'local desktop main frame'
    )
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it.each(['destroyed', 'render-process-gone', 'did-navigate'])(
    'releases subscriptions and timers on %s',
    async (reason) => {
      const input = event()
      await invoke(CUSTOM_USAGE_CHANNELS.subscribe, input)
      await invoke(CUSTOM_USAGE_CHANNELS.refresh, input)
      expect(mocks.fetch).toHaveBeenCalledTimes(1)
      input.sender.emit(reason)
      expect(vi.getTimerCount()).toBe(0)
      for (const name of ['destroyed', 'render-process-gone', 'did-navigate']) {
        expect(input.sender.listenerCount(name)).toBe(0)
      }
    }
  )
  it('keeps only a configuration subscription while disabled and enables without restarting', async () => {
    mocks.read.mockResolvedValue({ kind: 'disabled' })
    const input = event()
    await invoke(CUSTOM_USAGE_CHANNELS.subscribe, input)
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
    mocks.read.mockResolvedValue({ kind: 'enabled', config })
    expect(await invoke(CUSTOM_USAGE_CHANNELS.save, input, config)).toEqual({
      ok: true,
      settings: config
    })
    await invoke(CUSTOM_USAGE_CHANNELS.refresh, input)
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
    mocks.read.mockResolvedValue({ kind: 'disabled' })
    mocks.save.mockResolvedValue({ ...config, enabled: false })
    await invoke(CUSTOM_USAGE_CHANNELS.save, input, { ...config, enabled: false })
    expect(vi.getTimerCount()).toBe(0)
  })
  it('does not install a late subscription after unsubscribe during config IO', async () => {
    let complete: (value: CustomUsageConfiguration) => void = () => {}
    mocks.read.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve
        })
    )
    const input = event()
    const pending = invoke(CUSTOM_USAGE_CHANNELS.subscribe, input)
    mocks.events.get(CUSTOM_USAGE_CHANNELS.unsubscribe)?.(input)
    complete({ kind: 'disabled' })
    await pending
    expect(input.sender.listenerCount('destroyed')).toBe(0)
    expect(mocks.fetch).not.toHaveBeenCalled()
  })
  it('tests drafts without saving and rejects a concurrent preview', async () => {
    let finish: (value: ReturnType<typeof customUsageFixture>) => void = () => {}
    mocks.fetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const input = event()
    const first = invoke(CUSTOM_USAGE_CHANNELS.test, input, config)
    expect(await invoke(CUSTOM_USAGE_CHANNELS.test, input, config)).toEqual({
      ok: false,
      error: 'busy'
    })
    finish(customUsageFixture())
    expect(await first).toMatchObject({ ok: true })
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it('cancels preview on navigation and never forwards stderr/errors', async () => {
    mocks.fetch.mockImplementation(
      (_config, signal: AbortSignal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('private credential')), {
            once: true
          })
        })
    )
    const input = event()
    const pending = invoke(CUSTOM_USAGE_CHANNELS.test, input, config)
    input.sender.emit('did-navigate')
    expect(await pending).toEqual({ ok: false, error: 'script' })
    expect(input.sender.listenerCount('destroyed')).toBe(0)
  })
  it('uses a constrained file picker and does not spawn on selection', async () => {
    expect(await invoke(CUSTOM_USAGE_CHANNELS.choosePath, event(), 'arbitrary')).toBeNull()
    expect(mocks.picker).not.toHaveBeenCalled()
    expect(await invoke(CUSTOM_USAGE_CHANNELS.choosePath, event(), 'script')).toBeNull()
    expect(mocks.picker).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        properties: ['openFile'],
        filters: [{ name: 'Python', extensions: ['py'] }]
      })
    )
    expect(mocks.fetch).not.toHaveBeenCalled()
  })
})
