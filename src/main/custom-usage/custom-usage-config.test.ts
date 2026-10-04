import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  readCustomUsageConfiguration,
  readCustomUsageSettings,
  saveCustomUsageSettings
} from './custom-usage-config'
import {
  customUsageSettingsSchema,
  defaultCustomUsageSettings
} from '../../shared/custom-usage-settings'

const directories: string[] = []
async function directory(contents?: string): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), 'orca-custom-usage-config-'))
  directories.push(path)
  if (contents !== undefined) {
    await writeFile(join(path, 'custom-usage.json'), contents)
  }
  return path
}
afterEach(async () => {
  for (const path of directories.splice(0)) {
    await rm(path, { recursive: true, force: true })
  }
})

describe('user-owned script configuration', () => {
  it('defaults to disabled without enabling or discovering scripts', async () => {
    const root = await directory()
    expect(await readCustomUsageConfiguration(root)).toEqual({ kind: 'disabled' })
    expect(await readCustomUsageSettings(root)).toEqual({
      settings: defaultCustomUsageSettings(),
      error: null
    })
  })
  it('persists only known settings and keeps disabled draft paths without executing', async () => {
    const root = await directory()
    await saveCustomUsageSettings(root, {
      enabled: false,
      scriptPath: 'not selected',
      extra: 'not retained'
    })
    expect(JSON.parse(await readFile(join(root, 'custom-usage.json'), 'utf8'))).not.toHaveProperty(
      'extra'
    )
    expect(await readCustomUsageConfiguration(root)).toEqual({ kind: 'disabled' })
  })
  it('requires explicit trust, absolute paths, a Python file and a real interpreter', async () => {
    const root = await directory()
    const scriptPath = join(root, 'usage sample.py')
    await writeFile(scriptPath, 'print(1)')
    const settings = {
      ...defaultCustomUsageSettings(),
      enabled: true,
      pythonPath: process.execPath,
      scriptPath
    }
    await expect(saveCustomUsageSettings(root, settings)).rejects.toMatchObject({
      kind: 'untrusted'
    })
    await expect(
      saveCustomUsageSettings(root, { ...settings, trusted: true, scriptPath: 'relative.py' })
    ).rejects.toMatchObject({ kind: 'configuration' })
    await expect(
      saveCustomUsageSettings(root, {
        ...settings,
        trusted: true,
        pythonPath: join(root, 'missing')
      })
    ).rejects.toMatchObject({ kind: 'interpreter' })
    const saved = await saveCustomUsageSettings(root, { ...settings, trusted: true })
    expect(await readCustomUsageConfiguration(root)).toEqual({ kind: 'enabled', config: saved })
    expect(saved.pythonPath).toBe(process.execPath)
  })
  it.each(['{', ' '.repeat(17000), '{"enabled":"yes"}'])(
    'reports malformed/oversized settings without exposing file contents',
    async (contents) => {
      expect((await readCustomUsageSettings(await directory(contents))).error).toBe('configuration')
    }
  )
  it.each(['path\n.py', 'path\r.py', `path${String.fromCharCode(0)}.py`])(
    'rejects control characters',
    (scriptPath) => {
      expect(customUsageSettingsSchema.safeParse({ scriptPath }).success).toBe(false)
    }
  )
  it('does not silently reinterpret an old enabled HTTP configuration as trusted execution', async () => {
    const root = await directory(
      '{"enabled":true,"endpoint":"http://127.0.0.1:8765/v1/usage","tokenEnv":"SECRET"}'
    )
    expect(await readCustomUsageConfiguration(root)).toEqual({ kind: 'error', error: 'untrusted' })
    expect((await readCustomUsageSettings(root)).settings).not.toHaveProperty('tokenEnv')
  })
})
