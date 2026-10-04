import { ipcMain } from 'electron'
import { setCustomUsageShutdown } from './custom-usage-lifecycle'
import { CUSTOM_USAGE_CHANNELS } from '../../shared/custom-usage-api'
import { assertCustomUsageSender } from './custom-usage-sender'
import { CustomUsageScriptRunner } from './custom-usage-script'
import { registerCustomUsageSettingsHandlers } from './custom-usage-settings-ipc'
import { abortWhenRendererGone } from '../ipc/renderer-lifetime-abort'
import { getCanonicalUserDataPath } from '../persistence/loading-store/user-data-path'
import { readCustomUsageConfiguration } from './custom-usage-config'
import { CustomUsageService } from './custom-usage-service'

export function registerCustomUsageHandlers(): void {
  let service: CustomUsageService | null = null
  const runner = new CustomUsageScriptRunner()
  const subscriptions = new Map<number, () => void>()
  const getService = (): CustomUsageService => {
    service ??= new CustomUsageService({
      readConfiguration: () => readCustomUsageConfiguration(getCanonicalUserDataPath()),
      fetch: (config, signal) => runner.run(config, signal)
    })
    return service
  }
  ipcMain.handle(CUSTOM_USAGE_CHANNELS.read, (event) => {
    assertCustomUsageSender(event)
    return getService().read()
  })
  ipcMain.handle(CUSTOM_USAGE_CHANNELS.refresh, async (event) => {
    assertCustomUsageSender(event)
    await getService().reloadConfiguration()
    await getService().refresh()
  })
  ipcMain.handle(CUSTOM_USAGE_CHANNELS.subscribe, async (event) => {
    assertCustomUsageSender(event)
    const sender = event.sender
    subscriptions.get(sender.id)?.()
    const lifetime = abortWhenRendererGone(sender)
    let unsubscribe = (): void => {}
    const release = (): void => {
      unsubscribe()
      lifetime.dispose()
      lifetime.signal.removeEventListener('abort', release)
      if (subscriptions.get(sender.id) === release) {
        subscriptions.delete(sender.id)
      }
    }
    subscriptions.set(sender.id, release)
    lifetime.signal.addEventListener('abort', release, { once: true })
    await getService().read()
    if (lifetime.signal.aborted || subscriptions.get(sender.id) !== release) {
      return
    }
    unsubscribe = getService().subscribe((state) => {
      if (!sender.isDestroyed()) {
        sender.send(CUSTOM_USAGE_CHANNELS.changed, state)
      }
    })
  })
  ipcMain.on(CUSTOM_USAGE_CHANNELS.unsubscribe, (event) => {
    if (event.senderFrame === event.sender.mainFrame) {
      subscriptions.get(event.sender.id)?.()
    }
  })
  const disposeSettings = registerCustomUsageSettingsHandlers(getService, runner)
  let stopping: Promise<void> | null = null
  setCustomUsageShutdown(() => {
    if (stopping) {
      return stopping
    }
    disposeSettings()
    for (const release of subscriptions.values()) {
      release()
    }
    service?.dispose()
    stopping = runner.dispose()
    return stopping
  })
}
