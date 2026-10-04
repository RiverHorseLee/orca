import { BrowserWindow, dialog, ipcMain } from 'electron'
import { CUSTOM_USAGE_CHANNELS } from '../../shared/custom-usage-api'
import {
  customUsageSettingsSchema,
  type CustomUsageSaveResult,
  type CustomUsageTestResult
} from '../../shared/custom-usage-settings'
import { getCanonicalUserDataPath } from '../persistence/loading-store/user-data-path'
import { abortWhenRendererGone } from '../ipc/renderer-lifetime-abort'
import { readCustomUsageSettings, saveCustomUsageSettings } from './custom-usage-config'
import { assertCustomUsageSender } from './custom-usage-sender'
import { customUsageFailure } from './custom-usage-failure'
import type { CustomUsageService } from './custom-usage-service'
import type { CustomUsageScriptRunner } from './custom-usage-script'

export function registerCustomUsageSettingsHandlers(
  getService: () => CustomUsageService,
  runner: CustomUsageScriptRunner
): () => void {
  let preview: { senderId: number; controller: AbortController } | null = null
  let saving = false
  ipcMain.handle(CUSTOM_USAGE_CHANNELS.settings, (event) => {
    assertCustomUsageSender(event)
    return readCustomUsageSettings(getCanonicalUserDataPath())
  })
  ipcMain.handle(
    CUSTOM_USAGE_CHANNELS.save,
    async (event, value: unknown): Promise<CustomUsageSaveResult> => {
      assertCustomUsageSender(event)
      if (saving) {
        return { ok: false, error: 'busy' }
      }
      saving = true
      preview?.controller.abort()
      try {
        const settings = await saveCustomUsageSettings(getCanonicalUserDataPath(), value)
        await getService().reloadConfiguration()
        void getService().refresh()
        return { ok: true, settings }
      } catch (error) {
        return { ok: false, error: customUsageFailure(error) }
      } finally {
        saving = false
      }
    }
  )
  ipcMain.handle(
    CUSTOM_USAGE_CHANNELS.test,
    async (event, value: unknown): Promise<CustomUsageTestResult> => {
      assertCustomUsageSender(event)
      if (preview || saving) {
        return { ok: false, error: 'busy' }
      }
      const parsed = customUsageSettingsSchema.safeParse(value)
      if (!parsed.success) {
        return { ok: false, error: 'configuration' }
      }
      const controller = new AbortController()
      const lifetime = abortWhenRendererGone(event.sender)
      const operation = { senderId: event.sender.id, controller }
      preview = operation
      try {
        const snapshot = await runner.run(
          parsed.data,
          AbortSignal.any([controller.signal, lifetime.signal])
        )
        return { ok: true, snapshot }
      } catch (error) {
        return { ok: false, error: customUsageFailure(error) }
      } finally {
        lifetime.dispose()
        if (preview === operation) {
          preview = null
        }
      }
    }
  )
  ipcMain.on(CUSTOM_USAGE_CHANNELS.cancelTest, (event) => {
    if (event.senderFrame === event.sender.mainFrame && preview?.senderId === event.sender.id) {
      preview.controller.abort()
    }
  })
  ipcMain.handle(CUSTOM_USAGE_CHANNELS.choosePath, async (event, kind: unknown) => {
    assertCustomUsageSender(event)
    if (kind !== 'python' && kind !== 'script') {
      return null
    }
    const parent = BrowserWindow.fromWebContents(event.sender)
    if (!parent) {
      return null
    }
    const selection = await dialog.showOpenDialog(parent, {
      title: kind === 'script' ? 'Select usage Python script' : 'Select Python interpreter',
      properties: ['openFile'],
      filters:
        kind === 'script'
          ? [{ name: 'Python', extensions: ['py'] }]
          : [{ name: 'Files', extensions: process.platform === 'win32' ? ['exe'] : ['*'] }]
    })
    return selection.canceled || event.sender.isDestroyed()
      ? null
      : (selection.filePaths[0] ?? null)
  })
  return () => preview?.controller.abort()
}
