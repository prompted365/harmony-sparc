import { useState, useEffect, useCallback } from 'react'
import { SettingsConfig, SettingsExport, ImportResult, ConnectionTestResult } from '../types/settings'
import { useSettingsValidation } from './useSettingsValidation'

interface UseSettingsOptions {
  autoSave?: boolean
  autoSaveDelay?: number
  enableValidation?: boolean
}

interface UseSettingsReturn {
  settings: SettingsConfig
  updateSettings: (updates: Partial<SettingsConfig>) => void
  updateSection: <K extends keyof SettingsConfig>(section: K, data: Partial<SettingsConfig[K]>) => void
  saveSettings: () => Promise<void>
  loadSettings: () => Promise<void>
  resetSettings: () => void
  exportSettings: () => SettingsExport
  importSettings: (data: SettingsExport) => ImportResult
  testConnection: (provider: string, config: any) => Promise<ConnectionTestResult>
  isLoading: boolean
  isSaving: boolean
  hasUnsavedChanges: boolean
  lastSaved: Date | null
  validationResult: ReturnType<typeof useSettingsValidation>['validationResult']
  error: string | null
}

const DEFAULT_SETTINGS: SettingsConfig = {
  general: {
    appName: 'EESystem Content Curation',
    appDescription: 'AI-powered content curation platform',
    environment: 'development',
    debugMode: true,
    logLevel: 'info',
    maxUploadSize: 10485760,
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
}

export function useSettings(options: UseSettingsOptions = {}): UseSettingsReturn {
  const {
    autoSave = false,
    autoSaveDelay = 2000,
    enableValidation = true
  } = options

  const [settings, setSettings] = useState<SettingsConfig>(DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null)

  // Validation hook
  const validation = useSettingsValidation(settings)

  // Load settings from localStorage on component mount
  useEffect(() => {
    loadSettings()
  }, [])

  // Auto-save functionality
  useEffect(() => {
    if (autoSave && hasUnsavedChanges) {
      if (saveTimeout) {
        clearTimeout(saveTimeout)
      }

      const timeout = setTimeout(() => {
        saveSettings()
      }, autoSaveDelay)

      setSaveTimeout(timeout)

      return () => {
        if (timeout) {
          clearTimeout(timeout)
        }
      }
    }
  }, [settings, autoSave, autoSaveDelay, hasUnsavedChanges])

  const updateSettings = useCallback((updates: Partial<SettingsConfig>) => {
    setSettings(prev => {
      const newSettings = { ...prev, ...updates }
      setHasUnsavedChanges(true)
      return newSettings
    })
  }, [])

  const updateSection = useCallback(<K extends keyof SettingsConfig>(
    section: K, 
    data: Partial<SettingsConfig[K]>
  ) => {
    setSettings(prev => {
      const newSettings = {
        ...prev,
        [section]: {
          ...prev[section],
          ...data
        }
      }
      setHasUnsavedChanges(true)
      return newSettings
    })
  }, [])

  const saveSettings = useCallback(async () => {
    if (!hasUnsavedChanges || isSaving) return

    setIsSaving(true)
    setError(null)

    try {
      // Validate settings before saving
      if (enableValidation && !validation.validationResult.isValid) {
        throw new Error('Settings validation failed. Please fix errors before saving.')
      }

      // Save to localStorage
      localStorage.setItem('eesystem-settings', JSON.stringify(settings))

      // TODO: Save to API/backend
      // await api.saveSettings(settings)

      setHasUnsavedChanges(false)
      setLastSaved(new Date())
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save settings'
      setError(errorMessage)
      throw err
    } finally {
      setIsSaving(false)
    }
  }, [settings, hasUnsavedChanges, isSaving, enableValidation, validation.validationResult.isValid])

  const loadSettings = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Load from localStorage
      const saved = localStorage.getItem('eesystem-settings')
      if (saved) {
        const parsed = JSON.parse(saved)
        setSettings({ ...DEFAULT_SETTINGS, ...parsed })
      }

      // TODO: Load from API/backend
      // const serverSettings = await api.loadSettings()
      // if (serverSettings) {
      //   setSettings({ ...DEFAULT_SETTINGS, ...serverSettings })
      // }

      setHasUnsavedChanges(false)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load settings'
      setError(errorMessage)
      console.error('Error loading settings:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS)
    setHasUnsavedChanges(true)
    setError(null)
  }, [])

  const exportSettings = useCallback((): SettingsExport => {
    return {
      version: '1.0.0',
      timestamp: new Date(),
      settings,
      metadata: {
        appVersion: '1.0.0',
        exportedBy: 'EESystem',
        environment: settings.general.environment
      }
    }
  }, [settings])

  const importSettings = useCallback((data: SettingsExport): ImportResult => {
    try {
      const importedSettings: string[] = []
      const skippedSettings: string[] = []
      const errors: string[] = []

      // Validate import data
      if (!data.settings || typeof data.settings !== 'object') {
        errors.push('Invalid settings data format')
        return { success: false, message: 'Import failed', importedSettings, skippedSettings, errors }
      }

      // Merge settings carefully
      const newSettings = { ...DEFAULT_SETTINGS }
      
      Object.keys(data.settings).forEach(section => {
        if (section in newSettings) {
          newSettings[section as keyof SettingsConfig] = {
            ...newSettings[section as keyof SettingsConfig],
            ...data.settings[section as keyof SettingsConfig]
          }
          importedSettings.push(section)
        } else {
          skippedSettings.push(section)
        }
      })

      setSettings(newSettings)
      setHasUnsavedChanges(true)

      return {
        success: true,
        message: `Successfully imported ${importedSettings.length} setting sections`,
        importedSettings,
        skippedSettings,
        errors
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Import failed'
      return {
        success: false,
        message: errorMessage,
        importedSettings: [],
        skippedSettings: [],
        errors: [errorMessage]
      }
    }
  }, [])

  const testConnection = useCallback(async (provider: string, config: any): Promise<ConnectionTestResult> => {
    try {
      // Simulate connection test
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const success = Math.random() > 0.2 // 80% success rate for demo
      
      return {
        success,
        message: success ? 'Connection successful!' : 'Connection failed. Please check your configuration.',
        responseTime: success ? Math.floor(Math.random() * 200) + 50 : undefined,
        timestamp: new Date(),
        details: success ? { provider, status: 'connected' } : { provider, error: 'Authentication failed' }
      }
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Connection test failed',
        timestamp: new Date()
      }
    }
  }, [])

  return {
    settings,
    updateSettings,
    updateSection,
    saveSettings,
    loadSettings,
    resetSettings,
    exportSettings,
    importSettings,
    testConnection,
    isLoading,
    isSaving,
    hasUnsavedChanges,
    lastSaved,
    validationResult: validation.validationResult,
    error
  }
}