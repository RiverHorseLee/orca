import { useEffect, useRef, useState } from 'react'
import {
  defaultCustomUsageSettings,
  type CustomUsageSettings,
  type CustomUsageTestResult
} from '../../../../shared/custom-usage-settings'
import type { CustomUsageError } from '../../../../shared/custom-usage-contract'
import { getCustomUsageApi } from './use-custom-usage'

export function useCustomUsageSettings() {
  const api = getCustomUsageApi()
  const [draft, setDraft] = useState(defaultCustomUsageSettings)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<'save' | 'test' | 'browse' | null>(null)
  const [error, setError] = useState<CustomUsageError | null>(null)
  const [saved, setSaved] = useState(false)
  const [preview, setPreview] = useState<CustomUsageTestResult | null>(null)
  const mounted = useRef(false)
  const operationActive = useRef(false)
  useEffect(() => {
    mounted.current = true
    let active = true
    if (api) {
      void api
        .getSettings()
        .then((result) => {
          if (active) {
            setDraft(result.settings)
            setError(result.error)
            setLoading(false)
          }
        })
        .catch(() => {
          if (active) {
            setError('network')
            setLoading(false)
          }
        })
    } else {
      setLoading(false)
    }
    return () => {
      active = false
      mounted.current = false
      api?.cancelTest()
    }
  }, [api])

  const change = <K extends keyof CustomUsageSettings>(
    key: K,
    value: CustomUsageSettings[K]
  ): void => {
    setDraft((current) => ({
      ...current,
      [key]: value,
      trusted:
        key === 'pythonPath' || key === 'scriptPath'
          ? false
          : key === 'trusted'
            ? Boolean(value)
            : current.trusted
    }))
    setError(null)
    setPreview(null)
    setSaved(false)
  }
  const perform = async (
    kind: 'save' | 'test' | 'browse',
    action: () => Promise<void>
  ): Promise<void> => {
    if (!api || operationActive.current || loading) {
      return
    }
    operationActive.current = true
    setBusy(kind)
    setError(null)
    setSaved(false)
    try {
      await action()
    } catch {
      if (mounted.current) {
        setError('network')
      }
    } finally {
      operationActive.current = false
      if (mounted.current) {
        setBusy(null)
      }
    }
  }
  const save = (): void => {
    void perform('save', async () => {
      const result = await api?.saveSettings(draft)
      if (!mounted.current || !result) {
        return
      }
      if (result.ok) {
        setDraft(result.settings)
        setSaved(true)
        setPreview(null)
      } else {
        setError(result.error)
      }
    })
  }
  const test = (): void => {
    void perform('test', async () => {
      setPreview(null)
      const result = await api?.test(draft)
      if (mounted.current && result) {
        setPreview(result)
      }
    })
  }
  const browse = (kind: 'python' | 'script'): void => {
    void perform('browse', async () => {
      const path = await api?.choosePath(kind)
      if (mounted.current && path) {
        change(kind === 'python' ? 'pythonPath' : 'scriptPath', path)
      }
    })
  }
  return {
    supported: !!api,
    draft,
    loading,
    busy,
    error,
    saved,
    preview,
    change,
    save,
    test,
    browse,
    cancel: () => api?.cancelTest()
  }
}
