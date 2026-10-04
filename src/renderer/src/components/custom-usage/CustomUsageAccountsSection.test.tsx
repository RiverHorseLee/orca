// @vitest-environment happy-dom
import { act } from 'react'
import { render, fireEvent, cleanup, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CustomUsageApi } from '../../../../shared/custom-usage-api'
import { defaultCustomUsageSettings } from '../../../../shared/custom-usage-settings'
import { customUsageFixture } from '../../../../shared/custom-usage-test-fixture'
import { disabledCustomUsageState } from '../../../../shared/custom-usage-contract'
import { CustomUsageAccountsSection } from './CustomUsageAccountsSection'

const store = vi.hoisted(() => ({ settingsSearchQuery: '' }))
vi.mock('../../store', () => ({
  useAppStore: (select: (state: typeof store) => unknown) => select(store)
}))
vi.mock('@/i18n/i18n', () => ({
  i18n: { language: 'en' },
  translate: (_key: string, fallback: string, options?: { value?: number }) =>
    fallback.replace('{{value}}', String(options?.value ?? ''))
}))
function prepare() {
  const settings = {
    ...defaultCustomUsageSettings(),
    trusted: true,
    pythonPath: '/python',
    scriptPath: '/usage.py'
  }
  const api = {
    transport: 'desktop-local-v1',
    read: vi.fn(async () => disabledCustomUsageState()),
    refresh: vi.fn(async () => {}),
    subscribe: vi.fn(() => () => {}),
    getSettings: vi.fn(async () => ({ settings, error: null })),
    saveSettings: vi.fn<CustomUsageApi['saveSettings']>(async (value) => ({
      ok: true,
      settings: value
    })),
    test: vi.fn<CustomUsageApi['test']>(async () => ({ ok: true, snapshot: customUsageFixture() })),
    cancelTest: vi.fn(),
    choosePath: vi.fn(async () => '/selected/usage.py')
  } satisfies CustomUsageApi
  Object.defineProperty(window, 'orcaCustomUsage', { value: api, configurable: true })
  return api
}
afterEach(() => {
  cleanup()
  Reflect.deleteProperty(window, 'orcaCustomUsage')
  store.settingsSearchQuery = ''
  vi.unstubAllGlobals()
})
async function mount() {
  render(<CustomUsageAccountsSection />)
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(false)
  )
}

describe('Custom AI Provider Accounts settings', () => {
  it('loads editable interpreter/script fields and saves without restarting', async () => {
    const api = prepare()
    await mount()
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'My account' } })
    fireEvent.change(screen.getByLabelText('Refresh interval (seconds)'), {
      target: { value: '90' }
    })
    fireEvent.blur(screen.getByLabelText('Refresh interval (seconds)'))
    fireEvent.click(screen.getByRole('switch', { name: 'Enable custom usage' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText('Saved. The Usage list updates without restarting Orca.')
    expect(api.saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        name: 'My account',
        pollSeconds: 90,
        scriptPath: '/usage.py',
        trusted: true
      })
    )
  })
  it('requires renewed trust after either path is changed or chosen', async () => {
    const api = prepare()
    await mount()
    fireEvent.click(screen.getByRole('button', { name: 'Choose usage script' }))
    await waitFor(() => expect(api.choosePath).toHaveBeenCalledWith('script'))
    await waitFor(() =>
      expect(screen.getByRole('checkbox').getAttribute('aria-checked')).toBe('false')
    )
    expect(screen.getByRole('button', { name: 'Test usage' }).hasAttribute('disabled')).toBe(true)
    expect(api.test).not.toHaveBeenCalled()
  })
  it('tests unsaved drafts and displays metrics without saving', async () => {
    const api = prepare()
    await mount()
    fireEvent.click(screen.getByRole('button', { name: 'Test usage' }))
    await screen.findByText('Test succeeded (not saved)')
    expect(screen.getByText('42.5 / 100 USD')).toBeTruthy()
    expect(api.test).toHaveBeenCalledTimes(1)
    expect(api.saveSettings).not.toHaveBeenCalled()
  })
  it('cancels a running preview and releases it on unmount', async () => {
    const api = prepare()
    let resolveTest: (value: Awaited<ReturnType<CustomUsageApi['test']>>) => void = () => {}
    api.test.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveTest = resolve
        })
    )
    await mount()
    fireEvent.click(screen.getByRole('button', { name: 'Test usage' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel test' }))
    expect(api.cancelTest).toHaveBeenCalledTimes(1)
    cleanup()
    expect(api.cancelTest).toHaveBeenCalledTimes(2)
    await act(async () => resolveTest({ ok: false, error: 'cancelled' }))
  })
  it('does not expose local script execution on a Web client', async () => {
    const api = prepare()
    vi.stubGlobal('__ORCA_WEB_CLIENT__', true)
    render(<CustomUsageAccountsSection />)
    expect(screen.queryByLabelText('Python interpreter path')).toBeNull()
    expect(api.getSettings).not.toHaveBeenCalled()
    expect(api.test).not.toHaveBeenCalled()
  })
  it('matches Custom/Python searches and does not load an unrelated hidden section', () => {
    const api = prepare()
    store.settingsSearchQuery = 'unrelated-xyz'
    render(<CustomUsageAccountsSection />)
    expect(screen.queryByText('Custom')).toBeNull()
    expect(api.getSettings).not.toHaveBeenCalled()
  })
})
