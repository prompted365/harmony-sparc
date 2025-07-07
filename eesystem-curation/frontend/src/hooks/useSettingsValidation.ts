import { useState, useEffect } from 'react'
import { SettingsConfig, ValidationResult, ValidationError, ValidationWarning } from '../types/settings'

export function useSettingsValidation(settings: SettingsConfig) {
  const [validationResult, setValidationResult] = useState<ValidationResult>({
    isValid: true,
    errors: [],
    warnings: []
  })

  useEffect(() => {
    validateSettings(settings)
  }, [settings])

  const validateSettings = (config: SettingsConfig) => {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    // Validate General Settings
    validateGeneralSettings(config.general, errors, warnings)
    
    // Validate Database Settings
    validateDatabaseSettings(config.database, errors, warnings)
    
    // Validate API Key Settings
    validateApiKeySettings(config.apiKeys, errors, warnings)
    
    // Validate Deployment Settings
    validateDeploymentSettings(config.deployment, errors, warnings)

    const isValid = errors.length === 0

    setValidationResult({
      isValid,
      errors,
      warnings
    })
  }

  const validateGeneralSettings = (
    general: SettingsConfig['general'], 
    errors: ValidationError[], 
    warnings: ValidationWarning[]
  ) => {
    // App name validation
    if (!general.appName || general.appName.trim().length === 0) {
      errors.push({
        field: 'general.appName',
        message: 'Application name is required',
        code: 'REQUIRED_FIELD',
        severity: 'error'
      })
    } else if (general.appName.length > 100) {
      warnings.push({
        field: 'general.appName',
        message: 'Application name is very long',
        code: 'LONG_VALUE',
        severity: 'warning'
      })
    }

    // Max upload size validation
    if (general.maxUploadSize <= 0) {
      errors.push({
        field: 'general.maxUploadSize',
        message: 'Max upload size must be greater than 0',
        code: 'INVALID_VALUE',
        severity: 'error'
      })
    } else if (general.maxUploadSize > 104857600) { // 100MB
      warnings.push({
        field: 'general.maxUploadSize',
        message: 'Large upload sizes may impact performance',
        code: 'PERFORMANCE_WARNING',
        severity: 'warning'
      })
    }

    // File types validation
    if (!general.allowedFileTypes || general.allowedFileTypes.length === 0) {
      warnings.push({
        field: 'general.allowedFileTypes',
        message: 'No file types are allowed for upload',
        code: 'EMPTY_LIST',
        severity: 'warning'
      })
    }
  }

  const validateDatabaseSettings = (
    database: SettingsConfig['database'], 
    errors: ValidationError[], 
    warnings: ValidationWarning[]
  ) => {
    if (database.provider === 'astradb') {
      // AstraDB validation
      if (!database.astraDb.endpoint) {
        errors.push({
          field: 'database.astraDb.endpoint',
          message: 'AstraDB endpoint is required',
          code: 'REQUIRED_FIELD',
          severity: 'error'
        })
      } else if (!isValidUrl(database.astraDb.endpoint)) {
        errors.push({
          field: 'database.astraDb.endpoint',
          message: 'Invalid AstraDB endpoint URL',
          code: 'INVALID_URL',
          severity: 'error'
        })
      }

      if (!database.astraDb.applicationToken) {
        errors.push({
          field: 'database.astraDb.applicationToken',
          message: 'AstraDB application token is required',
          code: 'REQUIRED_FIELD',
          severity: 'error'
        })
      } else if (!database.astraDb.applicationToken.startsWith('AstraCS:')) {
        warnings.push({
          field: 'database.astraDb.applicationToken',
          message: 'Application token should start with "AstraCS:"',
          code: 'FORMAT_WARNING',
          severity: 'warning'
        })
      }

      if (!database.astraDb.keyspace) {
        errors.push({
          field: 'database.astraDb.keyspace',
          message: 'AstraDB keyspace is required',
          code: 'REQUIRED_FIELD',
          severity: 'error'
        })
      }

      if (database.astraDb.connectionStatus === 'error') {
        warnings.push({
          field: 'database.astraDb.connectionStatus',
          message: 'Database connection is failing',
          code: 'CONNECTION_ERROR',
          severity: 'warning'
        })
      }
    }

    // Connection pool validation
    if (database.connectionPoolSize <= 0 || database.connectionPoolSize > 100) {
      errors.push({
        field: 'database.connectionPoolSize',
        message: 'Connection pool size must be between 1 and 100',
        code: 'INVALID_RANGE',
        severity: 'error'
      })
    }

    if (database.connectionTimeout < 1000 || database.connectionTimeout > 300000) {
      warnings.push({
        field: 'database.connectionTimeout',
        message: 'Connection timeout should be between 1s and 5 minutes',
        code: 'RANGE_WARNING',
        severity: 'warning'
      })
    }
  }

  const validateApiKeySettings = (
    apiKeys: SettingsConfig['apiKeys'], 
    errors: ValidationError[], 
    warnings: ValidationWarning[]
  ) => {
    // LLM Router validation
    if (apiKeys.llmRouter.provider === 'requesty') {
      if (!apiKeys.llmRouter.requestyConfig.apiKey) {
        errors.push({
          field: 'apiKeys.llmRouter.requestyConfig.apiKey',
          message: 'Requesty API key is required',
          code: 'REQUIRED_FIELD',
          severity: 'error'
        })
      } else if (!apiKeys.llmRouter.requestyConfig.apiKey.startsWith('req_')) {
        warnings.push({
          field: 'apiKeys.llmRouter.requestyConfig.apiKey',
          message: 'Requesty API key should start with "req_"',
          code: 'FORMAT_WARNING',
          severity: 'warning'
        })
      }

      if (!isValidUrl(apiKeys.llmRouter.requestyConfig.baseUrl)) {
        errors.push({
          field: 'apiKeys.llmRouter.requestyConfig.baseUrl',
          message: 'Invalid base URL for Requesty',
          code: 'INVALID_URL',
          severity: 'error'
        })
      }

      if (apiKeys.llmRouter.requestyConfig.status === 'error') {
        warnings.push({
          field: 'apiKeys.llmRouter.requestyConfig.status',
          message: 'Requesty API connection is failing',
          code: 'CONNECTION_ERROR',
          severity: 'warning'
        })
      }
    }

    // OpenAI validation
    if (apiKeys.openai.apiKey) {
      if (!apiKeys.openai.apiKey.startsWith('sk-')) {
        warnings.push({
          field: 'apiKeys.openai.apiKey',
          message: 'OpenAI API key should start with "sk-"',
          code: 'FORMAT_WARNING',
          severity: 'warning'
        })
      }

      if (apiKeys.openai.status === 'error') {
        warnings.push({
          field: 'apiKeys.openai.status',
          message: 'OpenAI API connection is failing',
          code: 'CONNECTION_ERROR',
          severity: 'warning'
        })
      }

      // Parameter validation
      if (apiKeys.openai.temperature < 0 || apiKeys.openai.temperature > 2) {
        errors.push({
          field: 'apiKeys.openai.temperature',
          message: 'Temperature must be between 0 and 2',
          code: 'INVALID_RANGE',
          severity: 'error'
        })
      }

      if (apiKeys.openai.maxTokens <= 0 || apiKeys.openai.maxTokens > 128000) {
        errors.push({
          field: 'apiKeys.openai.maxTokens',
          message: 'Max tokens must be between 1 and 128000',
          code: 'INVALID_RANGE',
          severity: 'error'
        })
      }
    }

    // Anthropic validation
    if (apiKeys.anthropic.apiKey) {
      if (!apiKeys.anthropic.apiKey.startsWith('sk-ant-')) {
        warnings.push({
          field: 'apiKeys.anthropic.apiKey',
          message: 'Anthropic API key should start with "sk-ant-"',
          code: 'FORMAT_WARNING',
          severity: 'warning'
        })
      }

      if (apiKeys.anthropic.status === 'error') {
        warnings.push({
          field: 'apiKeys.anthropic.status',
          message: 'Anthropic API connection is failing',
          code: 'CONNECTION_ERROR',
          severity: 'warning'
        })
      }
    }

    // Rate limiting validation
    if (apiKeys.rateLimiting.enableRateLimiting) {
      if (apiKeys.rateLimiting.requestsPerMinute <= 0) {
        errors.push({
          field: 'apiKeys.rateLimiting.requestsPerMinute',
          message: 'Requests per minute must be greater than 0',
          code: 'INVALID_VALUE',
          severity: 'error'
        })
      }

      if (apiKeys.rateLimiting.requestsPerHour <= 0) {
        errors.push({
          field: 'apiKeys.rateLimiting.requestsPerHour',
          message: 'Requests per hour must be greater than 0',
          code: 'INVALID_VALUE',
          severity: 'error'
        })
      }

      if (apiKeys.rateLimiting.requestsPerDay <= 0) {
        errors.push({
          field: 'apiKeys.rateLimiting.requestsPerDay',
          message: 'Requests per day must be greater than 0',
          code: 'INVALID_VALUE',
          severity: 'error'
        })
      }

      // Check logical consistency
      if (apiKeys.rateLimiting.requestsPerMinute * 60 > apiKeys.rateLimiting.requestsPerHour) {
        warnings.push({
          field: 'apiKeys.rateLimiting',
          message: 'Requests per minute exceeds hourly limit',
          code: 'INCONSISTENT_LIMITS',
          severity: 'warning'
        })
      }

      if (apiKeys.rateLimiting.requestsPerHour * 24 > apiKeys.rateLimiting.requestsPerDay) {
        warnings.push({
          field: 'apiKeys.rateLimiting',
          message: 'Requests per hour exceeds daily limit',
          code: 'INCONSISTENT_LIMITS',
          severity: 'warning'
        })
      }
    }
  }

  const validateDeploymentSettings = (
    deployment: SettingsConfig['deployment'], 
    errors: ValidationError[], 
    warnings: ValidationWarning[]
  ) => {
    if (deployment.provider === 'railway') {
      if (!deployment.railway.apiKey) {
        errors.push({
          field: 'deployment.railway.apiKey',
          message: 'Railway API key is required',
          code: 'REQUIRED_FIELD',
          severity: 'error'
        })
      }

      if (!deployment.railway.projectId) {
        errors.push({
          field: 'deployment.railway.projectId',
          message: 'Railway project ID is required',
          code: 'REQUIRED_FIELD',
          severity: 'error'
        })
      }

      if (deployment.railway.deploymentStatus === 'failed') {
        warnings.push({
          field: 'deployment.railway.deploymentStatus',
          message: 'Last deployment failed',
          code: 'DEPLOYMENT_FAILED',
          severity: 'warning'
        })
      }
    }

    // Build settings validation
    if (!deployment.buildSettings.buildCommand) {
      errors.push({
        field: 'deployment.buildSettings.buildCommand',
        message: 'Build command is required',
        code: 'REQUIRED_FIELD',
        severity: 'error'
      })
    }

    if (!deployment.buildSettings.outputDirectory) {
      errors.push({
        field: 'deployment.buildSettings.outputDirectory',
        message: 'Output directory is required',
        code: 'REQUIRED_FIELD',
        severity: 'error'
      })
    }

    if (deployment.buildSettings.buildTimeout < 60000 || deployment.buildSettings.buildTimeout > 3600000) {
      warnings.push({
        field: 'deployment.buildSettings.buildTimeout',
        message: 'Build timeout should be between 1 minute and 1 hour',
        code: 'RANGE_WARNING',
        severity: 'warning'
      })
    }

    // Environment variables validation
    deployment.environmentVariables.forEach((envVar, index) => {
      if (!envVar.key) {
        errors.push({
          field: `deployment.environmentVariables[${index}].key`,
          message: 'Environment variable key is required',
          code: 'REQUIRED_FIELD',
          severity: 'error'
        })
      } else if (!/^[A-Z_][A-Z0-9_]*$/i.test(envVar.key)) {
        warnings.push({
          field: `deployment.environmentVariables[${index}].key`,
          message: 'Environment variable key should follow naming conventions',
          code: 'FORMAT_WARNING',
          severity: 'warning'
        })
      }

      if (!envVar.value && envVar.isRequired) {
        errors.push({
          field: `deployment.environmentVariables[${index}].value`,
          message: 'Required environment variable cannot be empty',
          code: 'REQUIRED_FIELD',
          severity: 'error'
        })
      }

      // Check for duplicate keys
      const duplicates = deployment.environmentVariables.filter(
        (other, otherIndex) => other.key === envVar.key && index !== otherIndex
      )
      if (duplicates.length > 0) {
        errors.push({
          field: `deployment.environmentVariables[${index}].key`,
          message: 'Duplicate environment variable key',
          code: 'DUPLICATE_KEY',
          severity: 'error'
        })
      }
    })
  }

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  const validateField = (fieldPath: string, value: any): ValidationResult => {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    // Field-specific validation logic would go here
    // This is a simplified version
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  const getFieldErrors = (fieldPath: string): ValidationError[] => {
    return validationResult.errors.filter(error => error.field === fieldPath)
  }

  const getFieldWarnings = (fieldPath: string): ValidationWarning[] => {
    return validationResult.warnings.filter(warning => warning.field === fieldPath)
  }

  const hasFieldErrors = (fieldPath: string): boolean => {
    return getFieldErrors(fieldPath).length > 0
  }

  const hasFieldWarnings = (fieldPath: string): boolean => {
    return getFieldWarnings(fieldPath).length > 0
  }

  const getValidationSummary = () => {
    const errorCount = validationResult.errors.length
    const warningCount = validationResult.warnings.length
    
    return {
      isValid: validationResult.isValid,
      errorCount,
      warningCount,
      totalIssues: errorCount + warningCount,
      severity: errorCount > 0 ? 'error' : warningCount > 0 ? 'warning' : 'success'
    }
  }

  return {
    validationResult,
    validateField,
    getFieldErrors,
    getFieldWarnings,
    hasFieldErrors,
    hasFieldWarnings,
    getValidationSummary,
    validateSettings: () => validateSettings(settings)
  }
}