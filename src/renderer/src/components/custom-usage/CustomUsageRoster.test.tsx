// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { render, cleanup, waitFor } from '@testing-library/react'
import type { CustomUsageApi } from '../../../../shared/custom-usage-api'
import {
  disabledCustomUsageState,
  type CustomUsageState
} from '../../../../shared/custom-usage-contract'
import { defaultCustomUsageSettings } from '../../../../shared/custom-usage-settings'
import { customUsageFixture } from '../../../../shared/custom-usage-test-fixture'
import {
  CustomUsageChip,
  CustomUsageMetrics,
  CustomUsageRosterRow,
  CUSTOM_USAGE_CHIP_ID
} from './CustomUsageRoster'
import { UsageOverflowChip } from '../status-bar/StatusBarProviderSegment'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useCustomUsage } from './use-custom-usage'

vi.mock('@/i18n/i18n', () => ({
  i18n: { language: 'en' },
  translate: (_key: string, fallback: string, options?: { value?: number }) =>
    fallback.replace('{{value}}', String(options?.value ?? ''))
}))
const ready = (): CustomUsageState => ({
  ...disabledCustomUsageState(),
  label: 'Custom account',
  status: 'ready',
  snapshot: customUsageFixture()
})
function prepare() {
  let listener: (state: CustomUsageState) => void = () => {}
  const release = vi.fn()
  const api = {
    transport: 'desktop-local-v1',
    read: vi.fn(async () => disabledCustomUsageState()),
    refresh: vi.fn(async () => {}),
    subscribe: vi.fn((callback) => {
      listener = callback
      return release
    }),
    getSettings: vi.fn(async () => ({ settings: defaultCustomUsageSettings(), error: null })),
    saveSettings: vi.fn<CustomUsageApi['saveSettings']>(),
    test: vi.fn<CustomUsageApi['test']>(),
    cancelTest: vi.fn(),
    choosePath: vi.fn(async () => null)
  } satisfies CustomUsageApi
  Object.defineProperty(window, 'orcaCustomUsage', { value: api, configurable: true })
  return { api, release, emit: (state: CustomUsageState) => listener(state) }
}
function Observer({ active = true }: { active?: boolean }) {
  const { state } = useCustomUsage(active)
  return <span>{state?.status ?? 'absent'}</span>
}
afterEach(() => {
  cleanup()
  Reflect.deleteProperty(window, 'orcaCustomUsage')
  vi.unstubAllGlobals()
})

describe('shared Usage roster contribution', () => {
  it('renders an inline chip, not a second button or independent popover', () => {
    const html = renderToStaticMarkup(
      <CustomUsageChip
        state={ready()}
        display="remaining"
        mode="compact"
        compact
        collapsed={false}
      />
    )
    expect(html).toContain('57% left')
    expect(html).toContain(`data-usage-chip="${CUSTOM_USAGE_CHIP_ID}"`)
    expect(html).not.toContain('<button')
    expect(html).not.toContain('data-slot="popover')
  })
  it('includes custom entries in the existing collapsed +N indicator', () => {
    const html = renderToStaticMarkup(
      <UsageOverflowChip
        hidden={[]}
        display="used"
        additionalHidden={[{ label: 'Custom account', tone: 'urgent' }]}
      />
    )
    expect(html).toContain('+1')
    expect(html).toContain('data-tone="urgent"')
    expect(html).toContain('data-usage-collapsed="false"')
  })
  it('uses remaining bars but retains explicit consumed amounts and plain counters', () => {
    const html = renderToStaticMarkup(<CustomUsageMetrics state={ready()} display="remaining" />)
    expect(html).toContain('42.5 / 100 USD')
    expect(html).toContain('65% left')
    expect(html.match(/role="progressbar"/g)).toHaveLength(2)
  })
  it('renders the custom row inside the standard Usage menu', async () => {
    const configure = vi.fn()
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>Usage</DropdownMenuTrigger>
        <DropdownMenuContent>
          <CustomUsageRosterRow
            state={ready()}
            display="used"
            mode="verbose"
            onConfigure={configure}
          />
        </DropdownMenuContent>
      </DropdownMenu>
    )
    expect(document.querySelector('[data-custom-usage-row]')?.textContent).toContain(
      'This computer · Account-wide'
    )
    const item = document.querySelector<HTMLElement>('[role="menuitem"]')
    await act(async () => item?.click())
    expect(configure).toHaveBeenCalledTimes(1)
  })
  it('receives enable/disable changes without restarting and drops stale initial reads', async () => {
    const { api, emit } = prepare()
    let resolveRead: (state: CustomUsageState) => void = () => {}
    api.read.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRead = resolve
        })
    )
    const view = render(<Observer />)
    await act(async () => emit(ready()))
    await act(async () => resolveRead(disabledCustomUsageState()))
    expect(view.container.textContent).toBe('ready')
    await act(async () => emit(disabledCustomUsageState()))
    expect(view.container.textContent).toBe('disabled')
    await act(async () => emit(ready()))
    expect(view.container.textContent).toBe('ready')
  })
  it('releases polling ownership when the statusbar is hidden', async () => {
    const { release } = prepare()
    const view = render(<Observer />)
    await waitFor(() => expect(view.container.textContent).toBe('disabled'))
    view.rerender(<Observer active={false} />)
    expect(release).toHaveBeenCalledTimes(1)
    expect(view.container.textContent).toBe('absent')
  })
  it('ignores the local capability in web/remote browser windows', () => {
    const { api } = prepare()
    vi.stubGlobal('__ORCA_WEB_CLIENT__', true)
    render(<Observer />)
    expect(api.read).not.toHaveBeenCalled()
    expect(api.subscribe).not.toHaveBeenCalled()
  })
})
