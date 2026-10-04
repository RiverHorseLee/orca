import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultCustomUsageSettings } from '../../shared/custom-usage-settings'
import { customUsageFixture } from '../../shared/custom-usage-test-fixture'
import type { ProcessResult } from '../../shared/child-process/run-process'
import { CustomUsageScriptRunner, runCustomUsageScript } from './custom-usage-script'

const directories: string[] = []
async function fixture(source = 'print(1)') {
  const root = await mkdtemp(join(tmpdir(), 'orca usage 中文 & '))
  directories.push(root)
  const scriptPath = join(root, 'usage 中文 & sample.py')
  await writeFile(scriptPath, source)
  return {
    ...defaultCustomUsageSettings(),
    enabled: true,
    trusted: true,
    pythonPath: process.execPath,
    scriptPath
  }
}
const signal = () => new AbortController().signal
function success(): ProcessResult {
  return {
    code: 0,
    signal: null,
    timedOut: false,
    stdout: '',
    stderr: '',
    stdoutBytes: Buffer.from(JSON.stringify(customUsageFixture()))
  }
}
afterEach(async () => {
  for (const path of directories.splice(0)) {
    await rm(path, { recursive: true, force: true })
  }
})

describe('bounded trusted Python invocation', () => {
  it('passes literal argv through the shared process wrapper with output and termination limits', async () => {
    const config = await fixture()
    const execute = vi.fn(async () => success())
    const snapshot = await runCustomUsageScript(config, signal(), execute)
    expect(snapshot.metrics).toHaveLength(3)
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        program: process.execPath,
        args: ['-X', 'utf8', '-u', config.scriptPath],
        terminationBarrier: true,
        killOnOutputLimit: true,
        maxOutputBytes: 262144
      })
    )
  })
  it.each([
    { result: { code: 1, stderr: 'private token must not reach UI' }, kind: 'script' },
    { result: { timedOut: true }, kind: 'timeout' },
    { result: { outputTruncated: true }, kind: 'invalid-response' },
    { result: { stdoutBytes: Buffer.from('log line\n{}') }, kind: 'invalid-response' },
    { result: { stdoutBytes: Buffer.from([255]) }, kind: 'invalid-response' },
    {
      result: {
        stdoutBytes: Buffer.from(
          JSON.stringify(customUsageFixture(new Date(Date.now() + 120000).toISOString()))
        )
      },
      kind: 'clock'
    }
  ])('sanitizes process failures ($kind)', async ({ result, kind }) => {
    await expect(
      runCustomUsageScript(await fixture(), signal(), async () => ({ ...success(), ...result }))
    ).rejects.toMatchObject({ kind, message: kind })
  })
  it('does not invoke untrusted scripts or an already-aborted request', async () => {
    const config = await fixture()
    const execute = vi.fn(async () => success())
    await expect(
      runCustomUsageScript({ ...config, trusted: false }, signal(), execute)
    ).rejects.toMatchObject({ kind: 'untrusted' })
    const controller = new AbortController()
    controller.abort()
    await expect(runCustomUsageScript(config, controller.signal, execute)).rejects.toMatchObject({
      kind: 'cancelled'
    })
    expect(execute).not.toHaveBeenCalled()
  })
  it('serializes poll/preview and cancels queued work before it can spawn', async () => {
    let release = (): void => {}
    const execute = vi.fn(async () => {
      await new Promise<void>((resolve) => {
        release = resolve
      })
      return customUsageFixture()
    })
    const runner = new CustomUsageScriptRunner(execute)
    const config = await fixture()
    const first = runner.run(config, signal())
    await Promise.resolve()
    const secondController = new AbortController()
    const second = runner.run(config, secondController.signal)
    const rejected = expect(second).rejects.toMatchObject({ kind: 'cancelled' })
    secondController.abort()
    release()
    await first
    await rejected
    expect(execute).toHaveBeenCalledTimes(1)
    runner.dispose()
  })
  it.skipIf(!process.env.ORCA_TEST_CUSTOM_USAGE_PYTHON)(
    'runs real Python from a path with spaces, Unicode and shell metacharacters',
    async () => {
      const config = await fixture(
        `import json\nprint(json.dumps(${JSON.stringify(JSON.stringify(customUsageFixture()))}))`
      )
      // Write actual JSON emission without treating a JSON object as Python syntax.
      await writeFile(
        config.scriptPath,
        `print(${JSON.stringify(JSON.stringify(customUsageFixture()))})`
      )
      const pythonPath = process.env.ORCA_TEST_CUSTOM_USAGE_PYTHON
      if (!pythonPath) {
        throw new Error('Expected configured Python')
      }
      expect(
        (await runCustomUsageScript({ ...config, pythonPath }, signal())).metrics
      ).toHaveLength(3)
    }
  )
  it.skipIf(!process.env.ORCA_TEST_CUSTOM_USAGE_PYTHON)(
    'terminates a real timed-out Python process before settling',
    async () => {
      const config = await fixture('import time\ntime.sleep(60)')
      const pythonPath = process.env.ORCA_TEST_CUSTOM_USAGE_PYTHON
      if (!pythonPath) {
        throw new Error('Expected configured Python')
      }
      await expect(
        runCustomUsageScript({ ...config, pythonPath, timeoutMs: 200 }, signal())
      ).rejects.toMatchObject({ kind: 'timeout' })
    }
  )
  it('waits for a cancelled process to finish termination before shutdown resolves', async () => {
    let finish: () => void = () => {}
    let activeSignal: AbortSignal | undefined
    const runner = new CustomUsageScriptRunner(async (_settings, signal) => {
      activeSignal = signal
      await new Promise<void>((resolve) => {
        finish = resolve
      })
      return customUsageFixture()
    })
    const operation = runner.run(await fixture(), signal())
    await Promise.resolve()
    let stopped = false
    const stopping = runner.dispose().then(() => {
      stopped = true
    })
    await Promise.resolve()
    expect(activeSignal?.aborted).toBe(true)
    expect(stopped).toBe(false)
    finish()
    await operation
    await stopping
    expect(stopped).toBe(true)
  })
})
