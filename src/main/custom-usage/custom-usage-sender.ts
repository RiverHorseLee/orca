import type { IpcMainInvokeEvent } from 'electron'
import { isTrustedBrowserRenderer } from '../ipc/browser-renderer-trust'
export function assertCustomUsageSender(event: IpcMainInvokeEvent): void {
  if (
    !isTrustedBrowserRenderer(event.sender) ||
    !event.senderFrame ||
    event.senderFrame !== event.sender.mainFrame
  ) {
    throw new Error('Custom usage requires the local desktop main frame')
  }
}
