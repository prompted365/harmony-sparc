import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card'
import { Input } from '../ui/Input'
import { Label } from '../ui/Label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select'
import { Switch } from '../ui/Switch'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Alert, AlertDescription, AlertTitle } from '../ui/Alert'
import { Progress } from '../ui/Progress'
import { Separator } from '../ui/Separator'
import { 
  Key, 
  TestTube, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Activity,
  Eye,
  EyeOff,
  Zap,
  DollarSign,
  BarChart3,
  Shield,
  Bot,
  Cpu,
  Image,
  Volume2,
  Sliders,
  TrendingUp
} from 'lucide-react'
import { ApiKeySettings as ApiKeySettingsType, SettingsFormState } from '../../types/settings'

interface ApiKeySettingsProps {
  config: ApiKeySettingsType
  onChange: (data: Partial<ApiKeySettingsType>) => void
  formState: SettingsFormState
}

export function ApiKeySettings({ config, onChange, formState }: ApiKeySettingsProps) {
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({})
  const [testingApi, setTestingApi] = useState<string | null>(null)

  const handleChange = (key: keyof ApiKeySettingsType, value: any) => {
    onChange({ [key]: value })
  }

  const handleProviderConfigChange = (provider: string, section: string, key: string, value: any) => {
    onChange({
      [provider]: {
        ...config[provider as keyof ApiKeySettingsType],
        [section]: {
          ...config[provider as keyof ApiKeySettingsType][section as keyof any],
          [key]: value
        }
      }
    })
  }

  const handleConfigChange = (provider: string, key: string, value: any) => {
    onChange({
      [provider]: {
        ...config[provider as keyof ApiKeySettingsType],
        [key]: value
      }
    })
  }

  const toggleApiKeyVisibility = (provider: string) => {
    setShowApiKeys(prev => ({
      ...prev,
      [provider]: !prev[provider]
    }))
  }

  const testApiConnection = async (provider: string) => {
    setTestingApi(provider)
    
    try {
      // Simulate API test
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const success = Math.random() > 0.2 // 80% success rate for demo
      
      // Update status based on provider
      if (provider === 'openai') {
        handleConfigChange('openai', 'status', success ? 'active' : 'error')
        handleConfigChange('openai', 'lastTest', new Date())
        if (!success) {
          handleConfigChange('openai', 'errorMessage', 'Invalid API key')
        }
      }
      // Add similar logic for other providers
    } catch (error) {
      console.error(`${provider} API test failed:`, error)
    } finally {
      setTestingApi(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Active
          </Badge>
        )
      case 'error':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Error
          </Badge>
        )
      default:
        return (
          <Badge variant="outline">
            <AlertCircle className="h-3 w-3 mr-1" />
            Inactive
          </Badge>
        )
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount)
  }

  return (
    <div className="space-y-6">
      {/* LLM Router Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bot className="h-5 w-5" />
            <span>LLM Router Configuration</span>
          </CardTitle>
          <CardDescription>
            Configure your primary LLM routing service for AI model access
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="llm-provider">LLM Router Provider</Label>
            <Select
              value={config.llmRouter.provider}
              onValueChange={(value) => handleProviderConfigChange('llmRouter', 'provider', '', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select LLM router" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="requesty">Requesty.ai</SelectItem>
                <SelectItem value="openrouter">OpenRouter</SelectItem>
                <SelectItem value="together">Together AI</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {config.llmRouter.provider === 'requesty' && (
            <Card className="bg-muted/50">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-lg">
                  <span>Requesty.ai Configuration</span>
                  {getStatusBadge(config.llmRouter.requestyConfig.status)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="requesty-api-key">API Key</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        id="requesty-api-key"
                        type={showApiKeys.requesty ? 'text' : 'password'}
                        value={config.llmRouter.requestyConfig.apiKey}
                        onChange={(e) => handleProviderConfigChange('llmRouter', 'requestyConfig', 'apiKey', e.target.value)}
                        placeholder="req_..."
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => toggleApiKeyVisibility('requesty')}
                      >
                        {showApiKeys.requesty ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="requesty-base-url">Base URL</Label>
                    <Input
                      id="requesty-base-url"
                      value={config.llmRouter.requestyConfig.baseUrl}
                      onChange={(e) => handleProviderConfigChange('llmRouter', 'requestyConfig', 'baseUrl', e.target.value)}
                      placeholder="https://api.requesty.ai"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="requesty-default-model">Default Model</Label>
                    <Select
                      value={config.llmRouter.requestyConfig.defaultModel}
                      onValueChange={(value) => handleProviderConfigChange('llmRouter', 'requestyConfig', 'defaultModel', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpt-4">GPT-4</SelectItem>
                        <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                        <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
                        <SelectItem value="claude-3-sonnet">Claude 3 Sonnet</SelectItem>
                        <SelectItem value="gemini-pro">Gemini Pro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="requesty-timeout">Request Timeout (ms)</Label>
                    <Input
                      id="requesty-timeout"
                      type="number"
                      value={config.llmRouter.requestyConfig.requestTimeout}
                      onChange={(e) => handleProviderConfigChange('llmRouter', 'requestyConfig', 'requestTimeout', parseInt(e.target.value))}
                      min="1000"
                      max="300000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label htmlFor="requesty-caching">Enable Caching</Label>
                      <p className="text-sm text-muted-foreground">Cache responses to reduce costs</p>
                    </div>
                    <Switch
                      id="requesty-caching"
                      checked={config.llmRouter.requestyConfig.enableCaching}
                      onCheckedChange={(checked) => handleProviderConfigChange('llmRouter', 'requestyConfig', 'enableCaching', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label htmlFor="requesty-metrics">Enable Metrics</Label>
                      <p className="text-sm text-muted-foreground">Track usage and performance</p>
                    </div>
                    <Switch
                      id="requesty-metrics"
                      checked={config.llmRouter.requestyConfig.enableMetrics}
                      onCheckedChange={(checked) => handleProviderConfigChange('llmRouter', 'requestyConfig', 'enableMetrics', checked)}
                    />
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <Button
                    onClick={() => testApiConnection('requesty')}
                    disabled={testingApi === 'requesty' || !config.llmRouter.requestyConfig.apiKey}
                    variant="outline"
                  >
                    {testingApi === 'requesty' ? (
                      <>
                        <Activity className="h-4 w-4 mr-2 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <TestTube className="h-4 w-4 mr-2" />
                        Test API
                      </>
                    )}
                  </Button>
                  {config.llmRouter.requestyConfig.lastTest && (
                    <p className="text-sm text-muted-foreground">
                      Last tested: {config.llmRouter.requestyConfig.lastTest.toLocaleString()}
                    </p>
                  )}
                </div>

                {config.llmRouter.requestyConfig.usage && (
                  <Card className="bg-background">
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center space-x-2">
                        <DollarSign className="h-4 w-4" />
                        <span>Usage & Billing</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                          <p className="text-2xl font-bold">{config.llmRouter.requestyConfig.usage.requestsToday.toLocaleString()}</p>
                          <p className="text-sm text-muted-foreground">Requests Today</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold">{(config.llmRouter.requestyConfig.usage.tokensToday / 1000).toFixed(1)}K</p>
                          <p className="text-sm text-muted-foreground">Tokens Today</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold">{formatCurrency(config.llmRouter.requestyConfig.usage.costToday)}</p>
                          <p className="text-sm text-muted-foreground">Cost Today</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Remaining Credits</span>
                          <Badge variant="outline">{formatCurrency(config.llmRouter.requestyConfig.usage.remainingCredits)}</Badge>
                        </div>
                        <Progress value={75} className="h-2" />
                        <p className="text-xs text-muted-foreground">75% of monthly quota remaining</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* OpenAI Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bot className="h-5 w-5" />
              <span>OpenAI Configuration</span>
            </div>
            {getStatusBadge(config.openai.status)}
          </CardTitle>
          <CardDescription>
            Configure direct OpenAI API access for GPT models
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="openai-api-key">API Key</Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="openai-api-key"
                  type={showApiKeys.openai ? 'text' : 'password'}
                  value={config.openai.apiKey}
                  onChange={(e) => handleConfigChange('openai', 'apiKey', e.target.value)}
                  placeholder="sk-..."
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => toggleApiKeyVisibility('openai')}
                >
                  {showApiKeys.openai ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="openai-org">Organization ID (Optional)</Label>
              <Input
                id="openai-org"
                value={config.openai.organization || ''}
                onChange={(e) => handleConfigChange('openai', 'organization', e.target.value)}
                placeholder="org-..."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="openai-model">Default Model</Label>
              <Select
                value={config.openai.defaultModel}
                onValueChange={(value) => handleConfigChange('openai', 'defaultModel', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4">GPT-4</SelectItem>
                  <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                  <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                  <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="openai-max-tokens">Max Tokens</Label>
              <Input
                id="openai-max-tokens"
                type="number"
                value={config.openai.maxTokens}
                onChange={(e) => handleConfigChange('openai', 'maxTokens', parseInt(e.target.value))}
                min="1"
                max="128000"
              />
            </div>
          </div>

          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="text-sm flex items-center space-x-2">
                <Sliders className="h-4 w-4" />
                <span>Model Parameters</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="openai-temperature">Temperature</Label>
                  <div className="space-y-1">
                    <Input
                      id="openai-temperature"
                      type="number"
                      step="0.1"
                      min="0"
                      max="2"
                      value={config.openai.temperature}
                      onChange={(e) => handleConfigChange('openai', 'temperature', parseFloat(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">0 = deterministic, 2 = very creative</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="openai-top-p">Top P</Label>
                  <div className="space-y-1">
                    <Input
                      id="openai-top-p"
                      type="number"
                      step="0.1"
                      min="0"
                      max="1"
                      value={config.openai.topP}
                      onChange={(e) => handleConfigChange('openai', 'topP', parseFloat(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">Nucleus sampling parameter</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="openai-frequency">Frequency Penalty</Label>
                  <Input
                    id="openai-frequency"
                    type="number"
                    step="0.1"
                    min="-2"
                    max="2"
                    value={config.openai.frequencyPenalty}
                    onChange={(e) => handleConfigChange('openai', 'frequencyPenalty', parseFloat(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="openai-presence">Presence Penalty</Label>
                  <Input
                    id="openai-presence"
                    type="number"
                    step="0.1"
                    min="-2"
                    max="2"
                    value={config.openai.presencePenalty}
                    onChange={(e) => handleConfigChange('openai', 'presencePenalty', parseFloat(e.target.value))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <Button
              onClick={() => testApiConnection('openai')}
              disabled={testingApi === 'openai' || !config.openai.apiKey}
              variant="outline"
            >
              {testingApi === 'openai' ? (
                <>
                  <Activity className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <TestTube className="h-4 w-4 mr-2" />
                  Test API
                </>
              )}
            </Button>
            <div className="flex items-center space-x-2">
              <Switch
                id="openai-functions"
                checked={config.openai.enableFunctionCalling}
                onCheckedChange={(checked) => handleConfigChange('openai', 'enableFunctionCalling', checked)}
              />
              <Label htmlFor="openai-functions">Function Calling</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Anthropic Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Cpu className="h-5 w-5" />
              <span>Anthropic Claude Configuration</span>
            </div>
            {getStatusBadge(config.anthropic.status)}
          </CardTitle>
          <CardDescription>
            Configure Anthropic Claude API for advanced reasoning
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="anthropic-api-key">API Key</Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="anthropic-api-key"
                  type={showApiKeys.anthropic ? 'text' : 'password'}
                  value={config.anthropic.apiKey}
                  onChange={(e) => handleConfigChange('anthropic', 'apiKey', e.target.value)}
                  placeholder="sk-ant-..."
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => toggleApiKeyVisibility('anthropic')}
                >
                  {showApiKeys.anthropic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="anthropic-model">Default Model</Label>
              <Select
                value={config.anthropic.defaultModel}
                onValueChange={(value) => handleConfigChange('anthropic', 'defaultModel', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="claude-3-opus-20240229">Claude 3 Opus</SelectItem>
                  <SelectItem value="claude-3-sonnet-20240229">Claude 3 Sonnet</SelectItem>
                  <SelectItem value="claude-3-haiku-20240307">Claude 3 Haiku</SelectItem>
                  <SelectItem value="claude-2.1">Claude 2.1</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Button
              onClick={() => testApiConnection('anthropic')}
              disabled={testingApi === 'anthropic' || !config.anthropic.apiKey}
              variant="outline"
            >
              {testingApi === 'anthropic' ? (
                <>
                  <Activity className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <TestTube className="h-4 w-4 mr-2" />
                  Test API
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Rate Limiting */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Rate Limiting</span>
          </CardTitle>
          <CardDescription>
            Configure API rate limiting to prevent overuse and control costs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="enable-rate-limiting">Enable Rate Limiting</Label>
              <p className="text-sm text-muted-foreground">
                Limit API requests to prevent excessive usage
              </p>
            </div>
            <Switch
              id="enable-rate-limiting"
              checked={config.rateLimiting.enableRateLimiting}
              onCheckedChange={(checked) => handleConfigChange('rateLimiting', 'enableRateLimiting', checked)}
            />
          </div>

          {config.rateLimiting.enableRateLimiting && (
            <>
              <Separator />
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="requests-per-minute">Requests per Minute</Label>
                  <Input
                    id="requests-per-minute"
                    type="number"
                    value={config.rateLimiting.requestsPerMinute}
                    onChange={(e) => handleConfigChange('rateLimiting', 'requestsPerMinute', parseInt(e.target.value))}
                    min="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="requests-per-hour">Requests per Hour</Label>
                  <Input
                    id="requests-per-hour"
                    type="number"
                    value={config.rateLimiting.requestsPerHour}
                    onChange={(e) => handleConfigChange('rateLimiting', 'requestsPerHour', parseInt(e.target.value))}
                    min="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="requests-per-day">Requests per Day</Label>
                  <Input
                    id="requests-per-day"
                    type="number"
                    value={config.rateLimiting.requestsPerDay}
                    onChange={(e) => handleConfigChange('rateLimiting', 'requestsPerDay', parseInt(e.target.value))}
                    min="1"
                  />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}