import { isAbsolute, join, extname } from 'node:path'
import { stat } from 'node:fs/promises'
import { readNodeFileWithinLimit } from '../../shared/node-bounded-file-reader'
import { writeSecureJsonFileWithinLimit } from '../../shared/bounded-secure-json-file'
import {
  customUsageSettingsSchema,
  defaultCustomUsageSettings,
  type CustomUsageSettings,
  type CustomUsageSettingsRead
} from '../../shared/custom-usage-settings'
import { CustomUsageFetchError } from './custom-usage-failure'

export type CustomUsageConfig = CustomUsageSettings
export type CustomUsageConfiguration =
  | { kind: 'disabled' }
  | { kind: 'error'; error: 'configuration' | 'untrusted' }
  | { kind: 'enabled'; config: CustomUsageConfig }

export async function readCustomUsageSettings(
  userDataPath: string
): Promise<CustomUsageSettingsRead> {
  try {
    const { buffer } = await readNodeFileWithinLimit(
      join(userDataPath, 'custom-usage.json'),
      16384,
      { regularFileOnly: true }
    )
    const raw: unknown = JSON.parse(buffer.toString('utf8'))
    const parsed = customUsageSettingsSchema.safeParse(raw)
    if (!parsed.success) {
      return { settings: defaultCustomUsageSettings(), error: 'configuration' }
    }
    return { settings: parsed.data, error: null }
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return { settings: defaultCustomUsageSettings(), error: null }
    }
    return { settings: defaultCustomUsageSettings(), error: 'configuration' }
  }
}

export async function readCustomUsageConfiguration(
  userDataPath: string
): Promise<CustomUsageConfiguration> {
  const { settings, error } = await readCustomUsageSettings(userDataPath)
  if (error) {
    return { kind: 'error', error: 'configuration' }
  }
  if (!settings.enabled) {
    return { kind: 'disabled' }
  }
  if (!settings.trusted) {
    return { kind: 'error', error: 'untrusted' }
  }
  if (!isAbsolute(settings.pythonPath) || !isAbsolute(settings.scriptPath)) {
    return { kind: 'error', error: 'configuration' }
  }
  return { kind: 'enabled', config: settings }
}

export async function validateCustomUsagePaths(settings: CustomUsageSettings): Promise<void> {
  if (!settings.trusted) {
    throw new CustomUsageFetchError('untrusted')
  }
  if (
    !isAbsolute(settings.pythonPath) ||
    !isAbsolute(settings.scriptPath) ||
    extname(settings.scriptPath).toLowerCase() !== '.py'
  ) {
    throw new CustomUsageFetchError('configuration')
  }
  if (['.cmd', '.bat', '.ps1'].includes(extname(settings.pythonPath).toLowerCase())) {
    throw new CustomUsageFetchError('interpreter')
  }
  for (const [path, kind] of [
    [settings.pythonPath, 'interpreter'],
    [settings.scriptPath, 'script']
  ] as const) {
    try {
      if (!(await stat(path)).isFile()) {
        throw new Error('Not a regular file')
      }
    } catch {
      throw new CustomUsageFetchError(kind)
    }
  }
}

export async function saveCustomUsageSettings(
  userDataPath: string,
  value: unknown
): Promise<CustomUsageSettings> {
  const parsed = customUsageSettingsSchema.safeParse(value)
  if (!parsed.success) {
    throw new CustomUsageFetchError('configuration')
  }
  if (parsed.data.enabled) {
    await validateCustomUsagePaths(parsed.data)
  }
  writeSecureJsonFileWithinLimit(join(userDataPath, 'custom-usage.json'), parsed.data, 16384, {
    durable: true
  })
  return parsed.data
}
