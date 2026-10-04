import { contextBridge, ipcRenderer } from 'electron'
import { CUSTOM_USAGE_CHANNELS, type CustomUsageApi } from '../shared/custom-usage-api'
import type { CustomUsageState } from '../shared/custom-usage-contract'

export function installCustomUsageBridge(): void {
  if (!process.isMainFrame) {
    return
  }
  const listeners = new Set<(state: CustomUsageState) => void>()
  let generation = 0
  const receive = (_event: Electron.IpcRendererEvent, state: CustomUsageState): void => {
    for (const listener of listeners) {
      listener(state)
    }
  }
  const api: CustomUsageApi = {
    transport: 'desktop-local-v1',
    read: () => ipcRenderer.invoke(CUSTOM_USAGE_CHANNELS.read),
    refresh: () => ipcRenderer.invoke(CUSTOM_USAGE_CHANNELS.refresh),
    getSettings: () => ipcRenderer.invoke(CUSTOM_USAGE_CHANNELS.settings),
    saveSettings: (settings) => ipcRenderer.invoke(CUSTOM_USAGE_CHANNELS.save, settings),
    test: (settings) => ipcRenderer.invoke(CUSTOM_USAGE_CHANNELS.test, settings),
    cancelTest: () => ipcRenderer.send(CUSTOM_USAGE_CHANNELS.cancelTest),
    choosePath: (kind) => ipcRenderer.invoke(CUSTOM_USAGE_CHANNELS.choosePath, kind),
    subscribe: (listener) => {
      const forward = (state: CustomUsageState): void => listener(state)
      listeners.add(forward)
      let active = true
      if (listeners.size === 1) {
        const currentGeneration = ++generation
        ipcRenderer.on(CUSTOM_USAGE_CHANNELS.changed, receive)
        void ipcRenderer.invoke(CUSTOM_USAGE_CHANNELS.subscribe).catch(() => {
          if (currentGeneration !== generation) {
            return
          }
          for (const callback of listeners) {
            callback({
              status: 'error',
              snapshot: null,
              error: 'network',
              isRefreshing: false,
              nextRefreshAt: null,
              staleAt: null
            })
          }
        })
      }
      return () => {
        if (!active) {
          return
        }
        active = false
        listeners.delete(forward)
        if (listeners.size === 0) {
          generation += 1
          ipcRenderer.removeListener(CUSTOM_USAGE_CHANNELS.changed, receive)
          ipcRenderer.send(CUSTOM_USAGE_CHANNELS.unsubscribe)
        }
      }
    }
  }
  if (process.contextIsolated) {
    contextBridge.exposeInMainWorld('orcaCustomUsage', api)
  } else {
    Object.defineProperty(window, 'orcaCustomUsage', { value: api })
  }
}
