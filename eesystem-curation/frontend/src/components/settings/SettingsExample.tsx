import React from 'react'
import { Settings } from './Settings'
import { useSettings } from '../../hooks/useSettings'
import { Button } from '../ui/Button'
import { Alert, AlertDescription } from '../ui/Alert'
import { Badge } from '../ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { CheckCircle, AlertCircle, Settings as SettingsIcon } from 'lucide-react'

/**
 * Example usage of the Settings components
 * This demonstrates how to integrate the settings system into your application
 */
export function SettingsExample() {
  const {
    settings,
    updateSettings,
    saveSettings,
    validationResult,
    isLoading,
    isSaving,
    hasUnsavedChanges,
    lastSaved,
    error
  } = useSettings({
    autoSave: false, // Disable auto-save for this example
    enableValidation: true
  })

  const validationSummary = {
    isValid: validationResult.isValid,
    errorCount: validationResult.errors.length,
    warningCount: validationResult.warnings.length,
    totalIssues: validationResult.errors.length + validationResult.warnings.length
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold brand-text">EESystem Settings</h1>
          <p className="text-muted-foreground text-lg">
            Configure your content curation platform
          </p>
        </div>

        {/* Status Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <SettingsIcon className="h-5 w-5" />
              <span>Settings Status</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  {validationSummary.isValid ? (
                    <CheckCircle className="h-8 w-8 text-green-500" />
                  ) : (
                    <AlertCircle className="h-8 w-8 text-red-500" />
                  )}
                </div>
                <p className="font-semibold">
                  {validationSummary.isValid ? 'Valid' : 'Invalid'}
                </p>
                <p className="text-sm text-muted-foreground">Configuration</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-500">
                  {validationSummary.errorCount}
                </p>
                <p className="text-sm text-muted-foreground">Errors</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-500">
                  {validationSummary.warningCount}
                </p>
                <p className="text-sm text-muted-foreground">Warnings</p>
              </div>
              <div className="text-center">
                <div className="mb-2">
                  {hasUnsavedChanges ? (
                    <Badge variant="destructive">Unsaved</Badge>
                  ) : (
                    <Badge variant="default">Saved</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {lastSaved ? `Last saved: ${lastSaved.toLocaleTimeString()}` : 'Not saved'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Validation Errors */}
        {validationResult.errors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <p className="font-semibold mb-2">Configuration errors found:</p>
              <ul className="list-disc list-inside space-y-1">
                {validationResult.errors.slice(0, 5).map((error, index) => (
                  <li key={index} className="text-sm">
                    <span className="font-mono">{error.field}</span>: {error.message}
                  </li>
                ))}
                {validationResult.errors.length > 5 && (
                  <li className="text-sm italic">
                    ...and {validationResult.errors.length - 5} more errors
                  </li>
                )}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Settings Component */}
        <Settings />

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={saveSettings}
                disabled={isSaving || !hasUnsavedChanges || !validationResult.isValid}
                className="brand-gradient"
              >
                {isSaving ? 'Saving...' : 'Save All Settings'}
              </Button>
              <Button
                variant="outline"
                onClick={() => updateSettings({
                  general: {
                    ...settings.general,
                    appName: 'EESystem Content Curation',
                    environment: 'development'
                  }
                })}
              >
                Reset to Defaults
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const exported = {
                    version: '1.0.0',
                    timestamp: new Date(),
                    settings,
                    metadata: {
                      appVersion: '1.0.0',
                      exportedBy: 'EESystem',
                      environment: settings.general.environment
                    }
                  }
                  const blob = new Blob([JSON.stringify(exported, null, 2)], { 
                    type: 'application/json' 
                  })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `eesystem-settings-${new Date().toISOString().split('T')[0]}.json`
                  document.body.appendChild(a)
                  a.click()
                  document.body.removeChild(a)
                  URL.revokeObjectURL(url)
                }}
              >
                Export Settings
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Settings Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold mb-2">General</h4>
                <div className="space-y-1 text-sm">
                  <p><span className="text-muted-foreground">App Name:</span> {settings.general.appName}</p>
                  <p><span className="text-muted-foreground">Environment:</span> {settings.general.environment}</p>
                  <p><span className="text-muted-foreground">Theme:</span> {settings.general.theme}</p>
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Database</h4>
                <div className="space-y-1 text-sm">
                  <p><span className="text-muted-foreground">Provider:</span> {settings.database.provider}</p>
                  <p>
                    <span className="text-muted-foreground">Status:</span>{' '}
                    <Badge variant={
                      settings.database.astraDb.connectionStatus === 'connected' ? 'default' : 'outline'
                    }>
                      {settings.database.astraDb.connectionStatus}
                    </Badge>
                  </p>
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-2">API Keys</h4>
                <div className="space-y-1 text-sm">
                  <p><span className="text-muted-foreground">LLM Router:</span> {settings.apiKeys.llmRouter.provider}</p>
                  <p>
                    <span className="text-muted-foreground">OpenAI:</span>{' '}
                    <Badge variant={settings.apiKeys.openai.apiKey ? 'default' : 'outline'}>
                      {settings.apiKeys.openai.apiKey ? 'Configured' : 'Not configured'}
                    </Badge>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Anthropic:</span>{' '}
                    <Badge variant={settings.apiKeys.anthropic.apiKey ? 'default' : 'outline'}>
                      {settings.apiKeys.anthropic.apiKey ? 'Configured' : 'Not configured'}
                    </Badge>
                  </p>
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Deployment</h4>
                <div className="space-y-1 text-sm">
                  <p><span className="text-muted-foreground">Provider:</span> {settings.deployment.provider}</p>
                  <p>
                    <span className="text-muted-foreground">Status:</span>{' '}
                    <Badge variant={
                      settings.deployment.railway.deploymentStatus === 'deployed' ? 'default' : 'outline'
                    }>
                      {settings.deployment.railway.deploymentStatus}
                    </Badge>
                  </p>
                  <p><span className="text-muted-foreground">Env Vars:</span> {settings.deployment.environmentVariables.length}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Example of how to use the settings in a route
export function SettingsRoute() {
  return (
    <div className="min-h-screen bg-background">
      <SettingsExample />
    </div>
  )
}

// Example of how to use individual settings components
export function DatabaseOnlySettings() {
  const { settings, updateSection } = useSettings()

  return (
    <div className="max-w-4xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Database Configuration</h1>
      {/* Individual component usage would go here */}
      <Card>
        <CardContent className="p-6">
          <p>Database-only settings would be rendered here using the DatabaseSettings component</p>
          <p className="text-sm text-muted-foreground mt-2">
            Current provider: {settings.database.provider}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default SettingsExample