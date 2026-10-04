import { z } from 'zod'
import type { CustomUsageError, CustomUsageSnapshot } from './custom-usage-contract'

const localPath = z
  .string()
  .max(4096)
  .refine(
    (value) =>
      !value.includes(String.fromCharCode(0)) && !value.includes('\r') && !value.includes('\n')
  )
export const customUsageSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  trusted: z.boolean().default(false),
  name: z.string().trim().min(1).max(80).default('Custom'),
  pythonPath: localPath.default(''),
  scriptPath: localPath.default(''),
  pollSeconds: z.number().int().min(15).max(3600).default(60),
  timeoutMs: z.number().int().min(100).max(30000).default(5000),
  staleAfterSeconds: z.number().int().min(15).max(86400).default(180)
})
export type CustomUsageSettings = z.infer<typeof customUsageSettingsSchema>
export type CustomUsageSettingsRead = {
  settings: CustomUsageSettings
  error: CustomUsageError | null
}
export type CustomUsageSaveResult =
  | { ok: true; settings: CustomUsageSettings }
  | { ok: false; error: CustomUsageError }
export type CustomUsageTestResult =
  | { ok: true; snapshot: CustomUsageSnapshot }
  | { ok: false; error: CustomUsageError }
export function defaultCustomUsageSettings(): CustomUsageSettings {
  return customUsageSettingsSchema.parse({})
}
