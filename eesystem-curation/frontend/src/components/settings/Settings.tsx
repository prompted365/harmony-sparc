import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/Tabs'
import { Button } from '../ui/Button'
import { Alert, AlertDescription, AlertTitle } from '../ui/Alert'
import { Badge } from '../ui/Badge'
import { Separator } from '../ui/Separator'
import { Save, RefreshCw, Download, Upload, AlertCircle, CheckCircle, Settings as SettingsIcon, Database, Key, Rocket } from 'lucide-react'
import { SettingsConfig, SettingsTab, SettingsFormState } from '../../types/settings'

// Import settings tab components
import { GeneralSettings } from './GeneralSettings'
import { DatabaseSettings } from './DatabaseSettings'
import { ApiKeySettings } from './ApiKeySettings'
import { DeploymentSettings } from './DeploymentSettings'

interface SettingsProps {
  className?: string
}

interface SettingsState {
  activeTab: SettingsTab
  formState: SettingsFormState
  config: SettingsConfig
  isLoading: boolean
  isSaving: boolean
  lastSaved?: Date
  hasUnsavedChanges: boolean
}

export function Settings({ className }: SettingsProps) {
  const [state, setState] = useState<SettingsState>({
    activeTab: 'general',
    formState: {
      data: {},
      errors: {},
      isSubmitting: false,
      isDirty: false,
      isValid: true,
      touchedFields: new Set()
    },
    config: {
      general: {
        appName: 'EESystem Content Curation',
        appDescription: 'AI-powered content curation platform',
        environment: 'development',
        debugMode: true,
        logLevel: 'info',
        maxUploadSize: 10485760, // 10MB
        allowedFileTypes: ['pdf', 'doc', 'docx', 'txt', 'md'],
        theme: 'system',
        timezone: 'UTC',
        dateFormat: 'YYYY-MM-DD',
        language: 'en'
      },
      database: {
        provider: 'astradb',
        astraDb: {
          endpoint: '',
          applicationToken: '',
          keyspace: 'eesystem',
          region: 'us-east-1',
          cloudProvider: 'aws',
          connectionStatus: 'disconnected'
        },
        postgresql: {
          host: '',
          port: 5432,
          database: '',
          username: '',
          password: '',
          ssl: true,
          connectionStatus: 'disconnected'
        },
        mongodb: {
          connectionString: '',
          database: '',
          username: '',
          password: '',
          ssl: true,
          connectionStatus: 'disconnected'
        },
        connectionPoolSize: 10,
        connectionTimeout: 30000,
        queryTimeout: 60000,
        enableQueryLogging: false,
        enableMetrics: true
      },
      apiKeys: {
        llmRouter: {
          provider: 'requesty',
          requestyConfig: {
            apiKey: '',
            baseUrl: 'https://api.requesty.ai',
            defaultModel: 'gpt-4',
            enableCaching: true,
            cacheTimeout: 3600,
            enableMetrics: true,
            requestTimeout: 30000,
            retryAttempts: 3,
            status: 'inactive'
          },
          openRouterConfig: {
            apiKey: '',
            baseUrl: 'https://openrouter.ai/api/v1',
            defaultModel: 'openai/gpt-4-turbo',
            enableCaching: true,
            status: 'inactive'
          },
          togetherConfig: {
            apiKey: '',
            baseUrl: 'https://api.together.xyz',
            defaultModel: 'meta-llama/Llama-2-70b-chat-hf',
            enableCaching: true,
            status: 'inactive'
          }
        },
        openai: {
          apiKey: '',
          baseUrl: 'https://api.openai.com/v1',
          defaultModel: 'gpt-4',
          enableFunctionCalling: true,
          maxTokens: 4096,
          temperature: 0.7,
          topP: 1.0,
          frequencyPenalty: 0.0,
          presencePenalty: 0.0,
          status: 'inactive'
        },
        anthropic: {
          apiKey: '',
          baseUrl: 'https://api.anthropic.com',
          defaultModel: 'claude-3-sonnet-20240229',
          maxTokens: 4096,
          temperature: 0.7,
          topP: 1.0,
          topK: 40,
          status: 'inactive'
        },
        elevenlabs: {
          apiKey: '',
          baseUrl: 'https://api.elevenlabs.io',
          defaultVoice: 'rachel',
          stability: 0.5,
          similarityBoost: 0.5,
          status: 'inactive'
        },
        stability: {
          apiKey: '',
          baseUrl: 'https://api.stability.ai',
          defaultEngine: 'stable-diffusion-xl-1024-v1-0',
          steps: 30,
          cfgScale: 7.0,
          status: 'inactive'
        },
        vercel: {
          apiKey: '',
          teamId: '',
          projectId: '',
          status: 'inactive'
        },
        rateLimiting: {
          enableRateLimiting: true,
          requestsPerMinute: 60,
          requestsPerHour: 1000,
          requestsPerDay: 10000,
          burstLimit: 100,
          enableIpWhitelist: false,
          ipWhitelist: [],
          enableUserLimits: false,
          userLimits: {}
        }
      },
      deployment: {
        provider: 'railway',
        railway: {
          apiKey: '',
          projectId: '',
          serviceId: '',
          environmentId: '',
          deploymentStatus: 'pending',
          status: 'inactive'
        },
        vercel: {
          apiKey: '',
          projectId: '',
          deploymentStatus: 'pending',
          status: 'inactive'
        },
        netlify: {
          apiKey: '',
          siteId: '',
          deploymentStatus: 'pending',
          status: 'inactive'
        },
        aws: {
          accessKeyId: '',
          secretAccessKey: '',
          region: 'us-east-1',
          status: 'inactive'
        },
        gcp: {
          projectId: '',
          serviceAccountKey: '',
          region: 'us-central1',
          status: 'inactive'
        },
        azure: {
          subscriptionId: '',
          resourceGroup: '',
          appService: '',
          region: 'East US',
          status: 'inactive'
        },
        buildSettings: {
          buildCommand: 'npm run build',
          outputDirectory: 'dist',
          nodeVersion: '20',
          environmentVariables: [],
          enableCache: true,
          cacheDirectory: '.cache',
          buildTimeout: 600000,
          enableOptimizations: true,
          enableSourceMaps: false,
          enableMinification: true
        },
        environmentVariables: []
      }
    },
    isLoading: false,
    isSaving: false,
    hasUnsavedChanges: false
  })

  // Load settings from localStorage or API
  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setState(prev => ({ ...prev, isLoading: true }))
    try {
      // Try to load from localStorage first
      const saved = localStorage.getItem('eesystem-settings')
      if (saved) {
        const parsed = JSON.parse(saved)
        setState(prev => ({ 
          ...prev, 
          config: { ...prev.config, ...parsed },
          isLoading: false 
        }))
      }
    } catch (error) {
      console.error('Error loading settings:', error)
      setState(prev => ({ ...prev, isLoading: false }))
    }
  }

  const saveSettings = async () => {
    setState(prev => ({ ...prev, isSaving: true }))
    try {
      // Save to localStorage
      localStorage.setItem('eesystem-settings', JSON.stringify(state.config))
      
      // TODO: Also save to API
      // await api.saveSettings(state.config)
      
      setState(prev => ({ 
        ...prev, 
        isSaving: false,
        hasUnsavedChanges: false,
        lastSaved: new Date()
      }))
    } catch (error) {
      console.error('Error saving settings:', error)
      setState(prev => ({ ...prev, isSaving: false }))
    }
  }

  const resetSettings = () => {
    // Reset to defaults
    setState(prev => ({ 
      ...prev, 
      hasUnsavedChanges: false,
      formState: {
        data: {},
        errors: {},
        isSubmitting: false,
        isDirty: false,
        isValid: true,
        touchedFields: new Set()
      }
    }))
    loadSettings()
  }

  const exportSettings = () => {
    const exportData = {
      version: '1.0.0',
      timestamp: new Date(),
      settings: state.config,
      metadata: {
        appVersion: '1.0.0',
        exportedBy: 'EESystem',
        environment: state.config.general.environment
      }
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `eesystem-settings-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const importSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const importData = JSON.parse(content)
        
        if (importData.settings) {
          setState(prev => ({ 
            ...prev, 
            config: { ...prev.config, ...importData.settings },
            hasUnsavedChanges: true
          }))
        }
      } catch (error) {
        console.error('Error importing settings:', error)
      }
    }
    reader.readAsText(file)
  }

  const updateConfig = (section: keyof SettingsConfig, data: any) => {
    setState(prev => ({
      ...prev,
      config: {
        ...prev.config,
        [section]: {
          ...prev.config[section],
          ...data
        }
      },
      hasUnsavedChanges: true
    }))
  }

  const getTabIcon = (tab: SettingsTab) => {
    switch (tab) {
      case 'general':
        return <SettingsIcon className="h-4 w-4" />
      case 'database':
        return <Database className="h-4 w-4" />
      case 'api-keys':
        return <Key className="h-4 w-4" />
      case 'deployment':
        return <Rocket className="h-4 w-4" />
      default:
        return <SettingsIcon className="h-4 w-4" />
    }
  }

  const getConnectionStatus = () => {
    let connected = 0
    let total = 0

    // Check database connections
    const dbProvider = state.config.database.provider
    if (dbProvider === 'astradb') {
      total++
      if (state.config.database.astraDb.connectionStatus === 'connected') connected++
    } else if (dbProvider === 'postgresql') {
      total++
      if (state.config.database.postgresql.connectionStatus === 'connected') connected++
    } else if (dbProvider === 'mongodb') {
      total++
      if (state.config.database.mongodb.connectionStatus === 'connected') connected++
    }

    // Check API connections
    const apiConfigs = [
      state.config.apiKeys.llmRouter.requestyConfig,
      state.config.apiKeys.openai,
      state.config.apiKeys.anthropic,
      state.config.apiKeys.elevenlabs,
      state.config.apiKeys.stability,
      state.config.apiKeys.vercel
    ]

    apiConfigs.forEach(config => {
      total++
      if (config.status === 'active') connected++
    })

    return { connected, total }
  }

  const { connected, total } = getConnectionStatus()

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight brand-text">Settings</h2>
          <p className="text-muted-foreground">
            Configure your EESystem Content Curation Platform
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={connected === total ? "default" : "secondary"}>
            {connected === total ? (
              <CheckCircle className="h-3 w-3 mr-1" />
            ) : (
              <AlertCircle className="h-3 w-3 mr-1" />
            )}
            {connected}/{total} Connected
          </Badge>
          {state.hasUnsavedChanges && (
            <Badge variant="destructive">
              Unsaved Changes
            </Badge>
          )}
          {state.lastSaved && (
            <p className="text-sm text-muted-foreground">
              Last saved: {state.lastSaved.toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center space-x-2">
        <Button
          onClick={saveSettings}
          disabled={state.isSaving || !state.hasUnsavedChanges}
          className="brand-gradient"
        >
          {state.isSaving ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {state.isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
        <Button
          variant="outline"
          onClick={resetSettings}
          disabled={state.isLoading}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Reset
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <Button
          variant="outline"
          onClick={exportSettings}
        >
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
        <div className="relative">
          <Button
            variant="outline"
            onClick={() => document.getElementById('import-file')?.click()}
          >
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <input
            id="import-file"
            type="file"
            accept=".json"
            className="hidden"
            onChange={importSettings}
          />
        </div>
      </div>

      {/* Main Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>
            Manage your platform settings across different sections
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            value={state.activeTab}
            onValueChange={(value) => setState(prev => ({ ...prev, activeTab: value as SettingsTab }))}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="general" className="flex items-center space-x-2">
                {getTabIcon('general')}
                <span>General</span>
              </TabsTrigger>
              <TabsTrigger value="database" className="flex items-center space-x-2">
                {getTabIcon('database')}
                <span>Database</span>
              </TabsTrigger>
              <TabsTrigger value="api-keys" className="flex items-center space-x-2">
                {getTabIcon('api-keys')}
                <span>API Keys</span>
              </TabsTrigger>
              <TabsTrigger value="deployment" className="flex items-center space-x-2">
                {getTabIcon('deployment')}
                <span>Deployment</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4">
              <GeneralSettings
                config={state.config.general}
                onChange={(data) => updateConfig('general', data)}
                formState={state.formState}
              />
            </TabsContent>

            <TabsContent value="database" className="space-y-4">
              <DatabaseSettings
                config={state.config.database}
                onChange={(data) => updateConfig('database', data)}
                formState={state.formState}
              />
            </TabsContent>

            <TabsContent value="api-keys" className="space-y-4">
              <ApiKeySettings
                config={state.config.apiKeys}
                onChange={(data) => updateConfig('apiKeys', data)}
                formState={state.formState}
              />
            </TabsContent>

            <TabsContent value="deployment" className="space-y-4">
              <DeploymentSettings
                config={state.config.deployment}
                onChange={(data) => updateConfig('deployment', data)}
                formState={state.formState}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}