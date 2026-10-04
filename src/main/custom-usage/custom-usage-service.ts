import {
  disabledCustomUsageState,
  type CustomUsageState,
  type CustomUsageSnapshot
} from '../../shared/custom-usage-contract'
import type { CustomUsageConfig, CustomUsageConfiguration } from './custom-usage-config'
import { CustomUsageFetchError } from './custom-usage-failure'
import { runCustomUsageScript } from './custom-usage-script'

type Listener = (state: CustomUsageState) => void
type Dependencies = {
  readConfiguration: () => Promise<CustomUsageConfiguration>
  fetch?: (config: CustomUsageConfig, signal: AbortSignal) => Promise<CustomUsageSnapshot>
  now?: () => number
  random?: () => number
}

export class CustomUsageService {
  private config: CustomUsageConfig | null = null
  private state = disabledCustomUsageState()
  private listeners = new Set<Listener>()
  private initialized = false
  private configurationRead: Promise<void> | null = null
  private work: Promise<void> | null = null
  private controller: AbortController | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private generation = 0
  private failures = 0
  private disposed = false
  private readonly now: () => number

  constructor(private readonly dependencies: Dependencies) {
    this.now = dependencies.now ?? Date.now
  }

  getState(): CustomUsageState {
    if (this.state.snapshot && this.state.staleAt !== null && this.now() >= this.state.staleAt) {
      return { ...this.state, status: 'stale' }
    }
    return this.state
  }

  async read(): Promise<CustomUsageState> {
    if (!this.initialized) {
      await this.reloadConfiguration()
    }
    return this.getState()
  }

  async reloadConfiguration(): Promise<void> {
    if (this.disposed) {
      return
    }
    if (this.configurationRead) {
      return this.configurationRead
    }
    const read = this.applyConfiguration()
    this.configurationRead = read
    try {
      await read
    } finally {
      if (this.configurationRead === read) {
        this.configurationRead = null
      }
    }
  }

  private async applyConfiguration(): Promise<void> {
    const result = await this.dependencies
      .readConfiguration()
      .catch((): CustomUsageConfiguration => ({ kind: 'error', error: 'configuration' }))
    if (this.disposed) {
      return
    }
    this.initialized = true
    const config = result.kind === 'enabled' ? result.config : null
    if (config && JSON.stringify(config) === JSON.stringify(this.config)) {
      return
    }
    this.stopWork()
    this.config = config
    this.failures = 0
    this.state = config
      ? { ...disabledCustomUsageState(), label: config.name, status: 'loading' }
      : result.kind === 'error'
        ? { ...disabledCustomUsageState(), status: 'error', error: result.error }
        : disabledCustomUsageState()
    this.publish()
  }

  subscribe(listener: Listener): () => void {
    if (this.disposed) {
      return () => {}
    }
    this.listeners.add(listener)
    listener(this.getState())
    void this.refresh()
    return () => {
      this.listeners.delete(listener)
      if (this.listeners.size === 0) {
        this.stopWork()
      }
    }
  }

  async refresh(): Promise<void> {
    if (this.disposed || !this.config || this.listeners.size === 0) {
      return
    }
    if (this.work) {
      return this.work
    }
    if (this.state.nextRefreshAt !== null && this.now() < this.state.nextRefreshAt) {
      this.armTimer()
      return
    }
    const work = this.fetchSnapshot(this.config)
    this.work = work
    try {
      await work
    } finally {
      if (this.work === work) {
        this.work = null
        this.armTimer()
      }
    }
  }

  private async fetchSnapshot(config: CustomUsageConfig): Promise<void> {
    const generation = this.generation
    const controller = new AbortController()
    this.controller = controller
    this.state = { ...this.state, isRefreshing: true }
    this.publish()
    let delayMs = config.pollSeconds * 1000
    try {
      const snapshot = await (this.dependencies.fetch ?? runCustomUsageScript)(
        config,
        controller.signal
      )
      if (generation !== this.generation) {
        return
      }
      this.failures = 0
      delayMs = Math.max(delayMs, (snapshot.refreshAfterSeconds ?? 0) * 1000)
      this.state = {
        label: config.name,
        status: 'ready',
        snapshot,
        error: null,
        isRefreshing: false,
        nextRefreshAt: this.now() + delayMs,
        staleAt: Date.parse(snapshot.observedAt) + config.staleAfterSeconds * 1000
      }
    } catch (error) {
      if (generation !== this.generation) {
        return
      }
      this.failures += 1
      const failure =
        error instanceof CustomUsageFetchError ? error : new CustomUsageFetchError('network')
      const backoff = Math.min(3600000, delayMs * 2 ** Math.min(this.failures - 1, 8))
      delayMs = Math.max(
        failure.retryAfterMs,
        Math.min(3600000, backoff * (1 + (this.dependencies.random ?? Math.random)() * 0.1))
      )
      this.state = {
        ...this.state,
        status: this.state.snapshot ? 'stale' : 'error',
        error: failure.kind,
        isRefreshing: false,
        nextRefreshAt: this.now() + delayMs
      }
    } finally {
      if (generation === this.generation) {
        this.controller = null
        this.publish()
      }
    }
  }

  private publish(): void {
    const state = this.getState()
    for (const listener of this.listeners) {
      listener(state)
    }
    this.armTimer()
  }

  private armTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer)
    }
    this.timer = null
    if (this.disposed || !this.config || this.listeners.size === 0) {
      return
    }
    const now = this.now()
    const deadlines: number[] = []
    if (!this.state.isRefreshing && this.state.nextRefreshAt !== null) {
      deadlines.push(this.state.nextRefreshAt)
    }
    if (this.state.status === 'ready' && this.state.staleAt !== null && this.state.staleAt > now) {
      deadlines.push(this.state.staleAt)
    }
    if (deadlines.length === 0) {
      return
    }
    this.timer = setTimeout(
      () => {
        this.timer = null
        const due = this.state.nextRefreshAt !== null && this.now() >= this.state.nextRefreshAt
        this.publish()
        if (due && !this.state.isRefreshing) {
          void this.refresh()
        }
      },
      Math.max(1, Math.min(...deadlines) - now)
    )
  }

  private stopWork(): void {
    this.generation += 1
    this.controller?.abort()
    this.controller = null
    this.work = null
    if (this.timer) {
      clearTimeout(this.timer)
    }
    this.timer = null
    this.state = { ...this.state, isRefreshing: false }
  }

  dispose(): void {
    this.disposed = true
    this.stopWork()
    this.listeners.clear()
    this.config = null
    this.state = disabledCustomUsageState()
  }
}
