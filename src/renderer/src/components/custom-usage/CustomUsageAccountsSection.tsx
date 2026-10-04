import { ChartNoAxesCombined, FolderOpen, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '../../store'
import { matchesSettingsSearch } from '../settings/settings-search'
import { NumberField } from '../settings/SettingsFormControls'
import { getCustomUsageSearchEntries } from './custom-usage-settings-search'
import { useCustomUsageSettings } from './use-custom-usage-settings'
import { CustomUsageMetrics } from './CustomUsageRoster'
import { customUsageErrorLabel } from './custom-usage-display'

function CustomUsageSettingsForm(): React.JSX.Element {
  const model = useCustomUsageSettings()
  const disabled = model.loading || model.busy !== null || !model.supported
  return (
    <section id="accounts-custom" className="scroll-mt-6 space-y-4">
      <div className="flex items-center gap-2">
        <ChartNoAxesCombined size={16} />
        <h3 className="text-sm font-medium">{translate('fork.customUsage.custom', 'Custom')}</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        {translate(
          'fork.customUsage.localSettings',
          'Local desktop only. Read usage from a trusted Python script; this is not the active SSH or WSL account.'
        )}
      </p>
      {!model.supported ? (
        <p role="status" className="text-sm text-muted-foreground">
          {translate(
            'fork.customUsage.unsupported',
            'Configure custom usage in the desktop app on the computer that will run the script.'
          )}
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="custom-usage-enabled">
              {translate('fork.customUsage.enable', 'Enable custom usage')}
            </Label>
            <Switch
              id="custom-usage-enabled"
              checked={model.draft.enabled}
              disabled={disabled}
              onCheckedChange={(value) => model.change('enabled', value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="custom-usage-name">
              {translate('fork.customUsage.name', 'Display name')}
            </Label>
            <Input
              id="custom-usage-name"
              value={model.draft.name}
              disabled={disabled}
              onChange={(event) => model.change('name', event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="custom-usage-python">
              {translate('fork.customUsage.pythonPath', 'Python interpreter path')}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="custom-usage-python"
                value={model.draft.pythonPath}
                disabled={disabled}
                onChange={(event) => model.change('pythonPath', event.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                disabled={disabled}
                onClick={() => model.browse('python')}
                aria-label={translate('fork.customUsage.browsePython', 'Choose Python interpreter')}
              >
                <FolderOpen />
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="custom-usage-script">
              {translate('fork.customUsage.scriptPath', 'Python usage script path')}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="custom-usage-script"
                value={model.draft.scriptPath}
                disabled={disabled}
                onChange={(event) => model.change('scriptPath', event.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                disabled={disabled}
                onClick={() => model.browse('script')}
                aria-label={translate('fork.customUsage.browseScript', 'Choose usage script')}
              >
                <FolderOpen />
              </Button>
            </div>
          </div>
          <fieldset disabled={disabled}>
            <NumberField
              label={translate('fork.customUsage.interval', 'Refresh interval (seconds)')}
              description={translate(
                'fork.customUsage.intervalRange',
                'Between 15 and 3600 seconds.'
              )}
              value={model.draft.pollSeconds}
              defaultValue={60}
              min={15}
              max={3600}
              integer
              onChange={(value) => model.change('pollSeconds', value)}
            />
          </fieldset>
          <div className="flex items-start gap-2">
            <Checkbox
              id="custom-usage-trust"
              checked={model.draft.trusted}
              disabled={disabled}
              onCheckedChange={(value) => model.change('trusted', value === true)}
            />
            <Label htmlFor="custom-usage-trust">
              {translate(
                'fork.customUsage.trust',
                'I trust this script. It will run with my local user permissions.'
              )}
            </Label>
          </div>
          <p className="text-xs text-muted-foreground">
            {translate(
              'fork.customUsage.jsonHint',
              'The script must print one JSON snapshot to stdout and exit. No local HTTP server or port is needed. Changing either path requires trusting the script again.'
            )}
          </p>
          <div className="flex items-center gap-2">
            <Button type="button" disabled={disabled} onClick={model.save}>
              {model.busy === 'save' ? <Loader2 className="animate-spin" /> : null}
              {translate('fork.customUsage.save', 'Save')}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={disabled || !model.draft.trusted}
              onClick={model.test}
            >
              {model.busy === 'test' ? <Loader2 className="animate-spin" /> : null}
              {translate('fork.customUsage.test', 'Test usage')}
            </Button>
            {model.busy === 'test' ? (
              <Button type="button" variant="ghost" onClick={model.cancel}>
                {translate('fork.customUsage.cancel', 'Cancel test')}
              </Button>
            ) : null}
          </div>
          {model.loading ? (
            <p role="status">
              {translate('fork.customUsage.loadingSettings', 'Loading configuration…')}
            </p>
          ) : null}
          {model.error ? (
            <p role="alert" className="text-sm text-destructive">
              {customUsageErrorLabel(model.error)}
            </p>
          ) : null}
          {model.saved ? (
            <p role="status" className="text-sm text-muted-foreground">
              {translate(
                'fork.customUsage.saved',
                'Saved. The Usage list updates without restarting Orca.'
              )}
            </p>
          ) : null}
          {model.preview ? (
            model.preview.ok ? (
              <div className="space-y-2 rounded-md border border-border p-3">
                <p role="status" className="text-sm font-medium">
                  {translate('fork.customUsage.testSuccess', 'Test succeeded (not saved)')}
                </p>
                <CustomUsageMetrics
                  state={{
                    status: 'ready',
                    snapshot: model.preview.snapshot,
                    error: null,
                    isRefreshing: false,
                    nextRefreshAt: null,
                    staleAt: null
                  }}
                />
              </div>
            ) : (
              <p role="alert" className="text-sm text-destructive">
                {customUsageErrorLabel(model.preview.error)}
              </p>
            )
          ) : null}
        </>
      )}
    </section>
  )
}
export function CustomUsageAccountsSection(): React.JSX.Element | null {
  const query = useAppStore((state) => state.settingsSearchQuery)
  return matchesSettingsSearch(query, getCustomUsageSearchEntries()) ? (
    <CustomUsageSettingsForm />
  ) : null
}
