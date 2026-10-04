import { dirname } from 'node:path'
import {
  runProcess,
  type ProcessResult,
  type ProcessSpec
} from '../../shared/child-process/run-process'
import {
  CUSTOM_USAGE_MAX_BYTES,
  customUsageSnapshotSchema,
  type CustomUsageSnapshot
} from '../../shared/custom-usage-contract'
import type { CustomUsageSettings } from '../../shared/custom-usage-settings'
import { validateCustomUsagePaths } from './custom-usage-config'
import { CustomUsageFetchError } from './custom-usage-failure'

type Execute = (spec: ProcessSpec) => Promise<ProcessResult>

export async function runCustomUsageScript(
  settings: CustomUsageSettings,
  signal: AbortSignal,
  execute: Execute = runProcess
): Promise<CustomUsageSnapshot> {
  if (signal.aborted) {
    throw new CustomUsageFetchError('cancelled')
  }
  await validateCustomUsagePaths(settings)
  if (signal.aborted) {
    throw new CustomUsageFetchError('cancelled')
  }
  let result: ProcessResult
  try {
    result = await execute({
      program: settings.pythonPath,
      args: ['-X', 'utf8', '-u', settings.scriptPath],
      cwd: dirname(settings.scriptPath),
      signal,
      timeoutMs: settings.timeoutMs,
      maxOutputBytes: CUSTOM_USAGE_MAX_BYTES,
      killOnOutputLimit: true,
      captureStdoutAsBytes: true,
      terminationBarrier: true,
      detached: process.platform !== 'win32'
    })
  } catch {
    throw new CustomUsageFetchError(signal.aborted ? 'cancelled' : 'interpreter')
  }
  if (signal.aborted) {
    throw new CustomUsageFetchError('cancelled')
  }
  if (result.timedOut) {
    throw new CustomUsageFetchError('timeout')
  }
  if (result.outputTruncated) {
    throw new CustomUsageFetchError('invalid-response')
  }
  if (result.code !== 0) {
    throw new CustomUsageFetchError('script')
  }
  try {
    const raw: unknown = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(
        result.stdoutBytes ?? Buffer.from(result.stdout)
      )
    )
    const parsed = customUsageSnapshotSchema.safeParse(raw)
    if (!parsed.success) {
      throw new CustomUsageFetchError('invalid-response')
    }
    if (Date.parse(parsed.data.observedAt) > Date.now() + 60000) {
      throw new CustomUsageFetchError('clock')
    }
    return parsed.data
  } catch (error) {
    throw error instanceof CustomUsageFetchError
      ? error
      : new CustomUsageFetchError('invalid-response')
  }
}

// Polling and the single settings preview share one process lane, including termination.
export class CustomUsageScriptRunner {
  private tail: Promise<void> = Promise.resolve()
  private shutdown = new AbortController()
  constructor(private readonly execute: typeof runCustomUsageScript = runCustomUsageScript) {}

  run(settings: CustomUsageSettings, signal: AbortSignal): Promise<CustomUsageSnapshot> {
    const combined = AbortSignal.any([signal, this.shutdown.signal])
    const operation = this.tail.then(() => {
      if (combined.aborted) {
        throw new CustomUsageFetchError('cancelled')
      }
      return this.execute(settings, combined)
    })
    this.tail = operation.then(
      () => {},
      () => {}
    )
    return operation
  }

  dispose(): Promise<void> {
    this.shutdown.abort()
    return this.tail
  }
}
