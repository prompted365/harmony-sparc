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
import { Textarea } from '../ui/Textarea'
import { 
  Rocket, 
  TestTube, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Activity,
  Eye,
  EyeOff,
  Zap,
  Settings,
  BarChart3,
  Globe,
  Code,
  Package,
  Plus,
  Trash2,
  ExternalLink,
  Download,
  Upload,
  Clock,
  Cpu,
  HardDrive,
  Network
} from 'lucide-react'
import { DeploymentSettings as DeploymentSettingsType, SettingsFormState, EnvironmentVariable } from '../../types/settings'

interface DeploymentSettingsProps {
  config: DeploymentSettingsType
  onChange: (data: Partial<DeploymentSettingsType>) => void
  formState: SettingsFormState
}

export function DeploymentSettings({ config, onChange, formState }: DeploymentSettingsProps) {
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})
  const [testingDeployment, setTestingDeployment] = useState(false)
  const [newEnvVar, setNewEnvVar] = useState<Partial<EnvironmentVariable>>({
    key: '',
    value: '',
    description: '',
    isRequired: false,
    isSecret: false,
    environment: 'all',
    category: 'other'
  })

  const handleChange = (key: keyof DeploymentSettingsType, value: any) => {
    onChange({ [key]: value })
  }

  const handleProviderConfigChange = (provider: string, key: string, value: any) => {
    onChange({
      [provider]: {
        ...config[provider as keyof DeploymentSettingsType],
        [key]: value
      }
    })
  }

  const handleBuildSettingsChange = (key: string, value: any) => {
    onChange({
      buildSettings: {
        ...config.buildSettings,
        [key]: value
      }
    })
  }

  const addEnvironmentVariable = () => {
    if (!newEnvVar.key || !newEnvVar.value) return

    const envVar: EnvironmentVariable = {
      ...newEnvVar,
      id: Date.now().toString()
    } as EnvironmentVariable

    onChange({
      environmentVariables: [...config.environmentVariables, envVar]
    })

    setNewEnvVar({
      key: '',
      value: '',
      description: '',
      isRequired: false,
      isSecret: false,
      environment: 'all',
      category: 'other'
    })
  }

  const removeEnvironmentVariable = (id: string) => {
    onChange({
      environmentVariables: config.environmentVariables.filter(env => env.id !== id)
    })
  }

  const toggleSecretVisibility = (id: string) => {
    setShowSecrets(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  const testDeployment = async () => {
    setTestingDeployment(true)
    
    try {
      // Simulate deployment test
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      const success = Math.random() > 0.3 // 70% success rate for demo
      
      if (config.provider === 'railway') {
        handleProviderConfigChange('railway', 'status', success ? 'active' : 'error')
        handleProviderConfigChange('railway', 'deploymentStatus', success ? 'deployed' : 'failed')
      }
    } catch (error) {
      console.error('Deployment test failed:', error)
    } finally {
      setTestingDeployment(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'deployed':
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Deployed
          </Badge>
        )
      case 'building':
        return (
          <Badge variant="secondary">
            <Activity className="h-3 w-3 mr-1 animate-spin" />
            Building
          </Badge>
        )
      case 'failed':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        )
      case 'pending':
        return (
          <Badge variant="outline">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        )
      default:
        return (
          <Badge variant="outline">
            <AlertCircle className="h-3 w-3 mr-1" />
            Unknown
          </Badge>
        )
    }
  }

  const renderRailwayConfig = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Rocket className="h-5 w-5" />
            <span>Railway Configuration</span>
          </div>
          {getStatusBadge(config.railway.deploymentStatus)}
        </CardTitle>
        <CardDescription>
          Configure Railway deployment settings and monitoring
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="railway-api-key">API Key</Label>
            <div className="flex items-center space-x-2">
              <Input
                id="railway-api-key"
                type={showSecrets.railway ? 'text' : 'password'}
                value={config.railway.apiKey}
                onChange={(e) => handleProviderConfigChange('railway', 'apiKey', e.target.value)}
                placeholder="rw_..."
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => toggleSecretVisibility('railway')}
              >
                {showSecrets.railway ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="railway-project-id">Project ID</Label>
            <Input
              id="railway-project-id"
              value={config.railway.projectId}
              onChange={(e) => handleProviderConfigChange('railway', 'projectId', e.target.value)}
              placeholder="project-id"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="railway-service-id">Service ID</Label>
            <Input
              id="railway-service-id"
              value={config.railway.serviceId}
              onChange={(e) => handleProviderConfigChange('railway', 'serviceId', e.target.value)}
              placeholder="service-id"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="railway-environment-id">Environment ID</Label>
            <Input
              id="railway-environment-id"
              value={config.railway.environmentId}
              onChange={(e) => handleProviderConfigChange('railway', 'environmentId', e.target.value)}
              placeholder="environment-id"
            />
          </div>
        </div>

        {config.railway.deploymentUrl && (
          <div className="space-y-2">
            <Label>Deployment URL</Label>
            <div className="flex items-center space-x-2">
              <Input
                value={config.railway.deploymentUrl}
                readOnly
                className="bg-muted"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => window.open(config.railway.deploymentUrl, '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <Separator />

        <div className="flex items-center justify-between">
          <Button
            onClick={testDeployment}
            disabled={testingDeployment || !config.railway.apiKey}
            variant="outline"
          >
            {testingDeployment ? (
              <>
                <Activity className="h-4 w-4 mr-2 animate-spin" />
                Testing Deployment...
              </>
            ) : (
              <>
                <TestTube className="h-4 w-4 mr-2" />
                Test Deployment
              </>
            )}
          </Button>
          {config.railway.lastDeployment && (
            <p className="text-sm text-muted-foreground">
              Last deployed: {config.railway.lastDeployment.toLocaleString()}
            </p>
          )}
        </div>

        {config.railway.metrics && (
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="text-sm flex items-center space-x-2">
                <BarChart3 className="h-4 w-4" />
                <span>Resource Usage</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm flex items-center space-x-1">
                      <Cpu className="h-3 w-3" />
                      <span>CPU Usage</span>
                    </span>
                    <Badge variant="outline">{config.railway.metrics.cpuUsage}%</Badge>
                  </div>
                  <Progress value={config.railway.metrics.cpuUsage} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm flex items-center space-x-1">
                      <HardDrive className="h-3 w-3" />
                      <span>Memory Usage</span>
                    </span>
                    <Badge variant="outline">{config.railway.metrics.memoryUsage}%</Badge>
                  </div>
                  <Progress value={config.railway.metrics.memoryUsage} className="h-2" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-lg font-semibold">{config.railway.metrics.uptime}%</p>
                  <p className="text-xs text-muted-foreground">Uptime</p>
                </div>
                <div>
                  <p className="text-lg font-semibold">{(config.railway.metrics.networkIn / 1024 / 1024).toFixed(1)}MB</p>
                  <p className="text-xs text-muted-foreground">Network In</p>
                </div>
                <div>
                  <p className="text-lg font-semibold">{(config.railway.metrics.networkOut / 1024 / 1024).toFixed(1)}MB</p>
                  <p className="text-xs text-muted-foreground">Network Out</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      {/* Deployment Provider Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Rocket className="h-5 w-5" />
            <span>Deployment Provider</span>
          </CardTitle>
          <CardDescription>
            Select and configure your deployment platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="deployment-provider">Provider</Label>
            <Select
              value={config.provider}
              onValueChange={(value) => handleChange('provider', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select deployment provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="railway">Railway</SelectItem>
                <SelectItem value="vercel">Vercel</SelectItem>
                <SelectItem value="netlify">Netlify</SelectItem>
                <SelectItem value="aws">AWS</SelectItem>
                <SelectItem value="gcp">Google Cloud Platform</SelectItem>
                <SelectItem value="azure">Microsoft Azure</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Provider-specific Configuration */}
      {config.provider === 'railway' && renderRailwayConfig()}

      {/* Build Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Package className="h-5 w-5" />
            <span>Build Settings</span>
          </CardTitle>
          <CardDescription>
            Configure build commands and optimization settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="build-command">Build Command</Label>
              <Input
                id="build-command"
                value={config.buildSettings.buildCommand}
                onChange={(e) => handleBuildSettingsChange('buildCommand', e.target.value)}
                placeholder="npm run build"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="output-directory">Output Directory</Label>
              <Input
                id="output-directory"
                value={config.buildSettings.outputDirectory}
                onChange={(e) => handleBuildSettingsChange('outputDirectory', e.target.value)}
                placeholder="dist"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="node-version">Node.js Version</Label>
              <Select
                value={config.buildSettings.nodeVersion}
                onValueChange={(value) => handleBuildSettingsChange('nodeVersion', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Node version" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="18">Node.js 18 LTS</SelectItem>
                  <SelectItem value="20">Node.js 20 LTS</SelectItem>
                  <SelectItem value="21">Node.js 21</SelectItem>
                  <SelectItem value="22">Node.js 22</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="build-timeout">Build Timeout (seconds)</Label>
              <Input
                id="build-timeout"
                type="number"
                value={config.buildSettings.buildTimeout / 1000}
                onChange={(e) => handleBuildSettingsChange('buildTimeout', parseInt(e.target.value) * 1000)}
                min="60"
                max="3600"
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <Label>Build Optimizations</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="enable-cache">Enable Build Cache</Label>
                  <p className="text-sm text-muted-foreground">Cache dependencies and build artifacts</p>
                </div>
                <Switch
                  id="enable-cache"
                  checked={config.buildSettings.enableCache}
                  onCheckedChange={(checked) => handleBuildSettingsChange('enableCache', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="enable-optimizations">Enable Optimizations</Label>
                  <p className="text-sm text-muted-foreground">Bundle optimization and tree shaking</p>
                </div>
                <Switch
                  id="enable-optimizations"
                  checked={config.buildSettings.enableOptimizations}
                  onCheckedChange={(checked) => handleBuildSettingsChange('enableOptimizations', checked)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="enable-minification">Enable Minification</Label>
                  <p className="text-sm text-muted-foreground">Minify JavaScript and CSS</p>
                </div>
                <Switch
                  id="enable-minification"
                  checked={config.buildSettings.enableMinification}
                  onCheckedChange={(checked) => handleBuildSettingsChange('enableMinification', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="enable-source-maps">Enable Source Maps</Label>
                  <p className="text-sm text-muted-foreground">Generate source maps for debugging</p>
                </div>
                <Switch
                  id="enable-source-maps"
                  checked={config.buildSettings.enableSourceMaps}
                  onCheckedChange={(checked) => handleBuildSettingsChange('enableSourceMaps', checked)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Environment Variables */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Environment Variables</span>
          </CardTitle>
          <CardDescription>
            Manage environment variables for your deployment
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add New Environment Variable */}
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="text-sm">Add Environment Variable</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="new-env-key">Key</Label>
                  <Input
                    id="new-env-key"
                    value={newEnvVar.key}
                    onChange={(e) => setNewEnvVar(prev => ({ ...prev, key: e.target.value }))}
                    placeholder="API_KEY"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="new-env-value">Value</Label>
                  <Input
                    id="new-env-value"
                    type={newEnvVar.isSecret ? 'password' : 'text'}
                    value={newEnvVar.value}
                    onChange={(e) => setNewEnvVar(prev => ({ ...prev, value: e.target.value }))}
                    placeholder="your-api-key"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-env-description">Description (Optional)</Label>
                <Input
                  id="new-env-description"
                  value={newEnvVar.description}
                  onChange={(e) => setNewEnvVar(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Description of this environment variable"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="new-env-environment">Environment</Label>
                  <Select
                    value={newEnvVar.environment}
                    onValueChange={(value) => setNewEnvVar(prev => ({ ...prev, environment: value as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="development">Development</SelectItem>
                      <SelectItem value="staging">Staging</SelectItem>
                      <SelectItem value="production">Production</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="new-env-category">Category</Label>
                  <Select
                    value={newEnvVar.category}
                    onValueChange={(value) => setNewEnvVar(prev => ({ ...prev, category: value as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="database">Database</SelectItem>
                      <SelectItem value="api">API</SelectItem>
                      <SelectItem value="deployment">Deployment</SelectItem>
                      <SelectItem value="feature">Feature</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>&nbsp;</Label>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="new-env-secret"
                      checked={newEnvVar.isSecret}
                      onCheckedChange={(checked) => setNewEnvVar(prev => ({ ...prev, isSecret: checked }))}
                    />
                    <Label htmlFor="new-env-secret" className="text-sm">Secret</Label>
                  </div>
                </div>
              </div>
              <Button
                onClick={addEnvironmentVariable}
                disabled={!newEnvVar.key || !newEnvVar.value}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Variable
              </Button>
            </CardContent>
          </Card>

          {/* Existing Environment Variables */}
          <div className="space-y-3">
            {config.environmentVariables.map((envVar) => (
              <Card key={envVar.id} className="bg-background">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 grid grid-cols-3 gap-4">
                      <div>
                        <div className="flex items-center space-x-2">
                          <Label className="font-mono text-sm">{envVar.key}</Label>
                          <Badge variant="outline" className="text-xs">
                            {envVar.category}
                          </Badge>
                          {envVar.isSecret && (
                            <Badge variant="secondary" className="text-xs">
                              Secret
                            </Badge>
                          )}
                        </div>
                        {envVar.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {envVar.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Input
                          type={envVar.isSecret && !showSecrets[envVar.id] ? 'password' : 'text'}
                          value={envVar.value}
                          readOnly
                          className="bg-muted text-sm"
                        />
                        {envVar.isSecret && (
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => toggleSecretVisibility(envVar.id)}
                          >
                            {showSecrets[envVar.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs">
                          {envVar.environment}
                        </Badge>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => removeEnvironmentVariable(envVar.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {config.environmentVariables.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No environment variables configured</p>
                <p className="text-sm">Add your first environment variable above</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}