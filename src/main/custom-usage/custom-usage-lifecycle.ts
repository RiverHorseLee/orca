let shutdown = (): Promise<void> => Promise.resolve()

export function setCustomUsageShutdown(stop: () => Promise<void>): void {
  shutdown = stop
}

export function stopCustomUsage(): Promise<void> {
  return shutdown()
}
