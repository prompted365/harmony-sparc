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
  Database, 
  TestTube, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Activity,
  Settings,
  Eye,
  EyeOff,
  Clock,
  Zap,
  BarChart3
} from 'lucide-react'
import { DatabaseSettings as DatabaseSettingsType, SettingsFormState, ConnectionTestResult } from '../../types/settings'

interface DatabaseSettingsProps {
  config: DatabaseSettingsType
  onChange: (data: Partial<DatabaseSettingsType>) => void
  formState: SettingsFormState
}

export function DatabaseSettings({ config, onChange, formState }: DatabaseSettingsProps) {
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [showPasswords, setShowPasswords] = useState(false)
  const [connectionResult, setConnectionResult] = useState<ConnectionTestResult | null>(null)

  const handleChange = (key: keyof DatabaseSettingsType, value: any) => {
    onChange({ [key]: value })
  }

  const handleProviderConfigChange = (provider: string, key: string, value: any) => {
    onChange({
      [provider]: {
        ...config[provider as keyof DatabaseSettingsType],
        [key]: value
      }
    })
  }

  const testConnection = async () => {
    setIsTestingConnection(true)
    setConnectionResult(null)

    try {
      // Simulate connection test
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const success = Math.random() > 0.3 // 70% success rate for demo
      const result: ConnectionTestResult = {
        success,
        message: success ? 'Connection successful!' : 'Connection failed. Please check your credentials.',
        responseTime: Math.floor(Math.random() * 200) + 50,
        timestamp: new Date(),
        details: success ? {
          version: '4.0.1',
          region: config.astraDb.region,
          keyspace: config.astraDb.keyspace
        } : {
          error: 'Authentication failed',
          code: 'AUTH_ERROR'
        }
      }

      setConnectionResult(result)
      
      // Update connection status
      const provider = config.provider
      if (provider === 'astradb') {
        handleProviderConfigChange('astraDb', 'connectionStatus', success ? 'connected' : 'error')
        handleProviderConfigChange('astraDb', 'lastConnectionTest', new Date())
        if (!success) {
          handleProviderConfigChange('astraDb', 'errorMessage', result.message)
        }
      }
    } catch (error) {
      console.error('Connection test failed:', error)
      setConnectionResult({
        success: false,
        message: 'Connection test failed due to network error',
        timestamp: new Date()
      })
    } finally {
      setIsTestingConnection(false)
    }
  }

  const getConnectionStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Connected
          </Badge>
        )
      case 'testing':
        return (
          <Badge variant="secondary">
            <Activity className="h-3 w-3 mr-1 animate-pulse" />
            Testing
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
            Disconnected
          </Badge>
        )
    }
  }

  const renderAstraDbConfig = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Database className="h-5 w-5" />
            <span>AstraDB Configuration</span>
          </div>
          {getConnectionStatusBadge(config.astraDb.connectionStatus)}
        </CardTitle>
        <CardDescription>
          Configure your DataStax AstraDB connection for vector and document storage
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="astra-endpoint">Database Endpoint</Label>
            <Input
              id="astra-endpoint"
              value={config.astraDb.endpoint}
              onChange={(e) => handleProviderConfigChange('astraDb', 'endpoint', e.target.value)}
              placeholder="https://your-database-id-region.apps.astra.datastax.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="astra-keyspace">Keyspace</Label>
            <Input
              id="astra-keyspace"
              value={config.astraDb.keyspace}
              onChange={(e) => handleProviderConfigChange('astraDb', 'keyspace', e.target.value)}
              placeholder="eesystem"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="astra-token">Application Token</Label>
          <div className="flex items-center space-x-2">
            <Input
              id="astra-token"
              type={showPasswords ? 'text' : 'password'}
              value={config.astraDb.applicationToken}
              onChange={(e) => handleProviderConfigChange('astraDb', 'applicationToken', e.target.value)}
              placeholder="AstraCS:..."
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowPasswords(!showPasswords)}
            >
              {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="astra-region">Region</Label>
            <Select
              value={config.astraDb.region}
              onValueChange={(value) => handleProviderConfigChange('astraDb', 'region', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="us-east-1">US East (N. Virginia)</SelectItem>
                <SelectItem value="us-east-2">US East (Ohio)</SelectItem>
                <SelectItem value="us-west-1">US West (N. California)</SelectItem>
                <SelectItem value="us-west-2">US West (Oregon)</SelectItem>
                <SelectItem value="eu-west-1">Europe (Ireland)</SelectItem>
                <SelectItem value="eu-central-1">Europe (Frankfurt)</SelectItem>
                <SelectItem value="ap-southeast-1">Asia Pacific (Singapore)</SelectItem>
                <SelectItem value="ap-northeast-1">Asia Pacific (Tokyo)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="astra-cloud">Cloud Provider</Label>
            <Select
              value={config.astraDb.cloudProvider}
              onValueChange={(value) => handleProviderConfigChange('astraDb', 'cloudProvider', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select cloud provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aws">Amazon Web Services</SelectItem>
                <SelectItem value="gcp">Google Cloud Platform</SelectItem>
                <SelectItem value="azure">Microsoft Azure</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <Button
            onClick={testConnection}
            disabled={isTestingConnection || !config.astraDb.endpoint || !config.astraDb.applicationToken}
            variant="outline"
          >
            {isTestingConnection ? (
              <>
                <Activity className="h-4 w-4 mr-2 animate-spin" />
                Testing Connection...
              </>
            ) : (
              <>
                <TestTube className="h-4 w-4 mr-2" />
                Test Connection
              </>
            )}
          </Button>
          {config.astraDb.lastConnectionTest && (
            <p className="text-sm text-muted-foreground">
              Last tested: {config.astraDb.lastConnectionTest.toLocaleString()}
            </p>
          )}
        </div>

        {connectionResult && (
          <Alert variant={connectionResult.success ? "default" : "destructive"}>
            {connectionResult.success ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <AlertTitle>Connection Test Result</AlertTitle>
            <AlertDescription>
              {connectionResult.message}
              {connectionResult.responseTime && (
                <span className="block mt-1">Response time: {connectionResult.responseTime}ms</span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {config.astraDb.performanceMetrics && (
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="text-sm">Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Average Response Time</span>
                <Badge variant="outline">{config.astraDb.performanceMetrics.avgResponseTime}ms</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Requests per Second</span>
                <Badge variant="outline">{config.astraDb.performanceMetrics.requestsPerSecond}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Error Rate</span>
                <Badge variant={config.astraDb.performanceMetrics.errorRate < 0.01 ? "default" : "destructive"}>
                  {(config.astraDb.performanceMetrics.errorRate * 100).toFixed(2)}%
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      {/* Database Provider Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Database className="h-5 w-5" />
            <span>Database Provider</span>
          </CardTitle>
          <CardDescription>
            Select and configure your primary database provider
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="database-provider">Provider</Label>
            <Select
              value={config.provider}
              onValueChange={(value) => handleChange('provider', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select database provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="astradb">DataStax AstraDB</SelectItem>
                <SelectItem value="postgresql">PostgreSQL</SelectItem>
                <SelectItem value="mongodb">MongoDB</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Provider-specific Configuration */}
      {config.provider === 'astradb' && renderAstraDbConfig()}

      {/* Connection Pool Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Connection Pool Settings</span>
          </CardTitle>
          <CardDescription>
            Configure database connection pooling and timeouts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pool-size">Pool Size</Label>
              <Input
                id="pool-size"
                type="number"
                value={config.connectionPoolSize}
                onChange={(e) => handleChange('connectionPoolSize', parseInt(e.target.value))}
                min="1"
                max="100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="connection-timeout">Connection Timeout (ms)</Label>
              <Input
                id="connection-timeout"
                type="number"
                value={config.connectionTimeout}
                onChange={(e) => handleChange('connectionTimeout', parseInt(e.target.value))}
                min="1000"
                max="300000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="query-timeout">Query Timeout (ms)</Label>
              <Input
                id="query-timeout"
                type="number"
                value={config.queryTimeout}
                onChange={(e) => handleChange('queryTimeout', parseInt(e.target.value))}
                min="1000"
                max="300000"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monitoring and Logging */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5" />
            <span>Monitoring and Logging</span>
          </CardTitle>
          <CardDescription>
            Configure database monitoring and query logging
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="query-logging">Query Logging</Label>
              <p className="text-sm text-muted-foreground">
                Log all database queries for debugging and performance analysis
              </p>
            </div>
            <Switch
              id="query-logging"
              checked={config.enableQueryLogging}
              onCheckedChange={(checked) => handleChange('enableQueryLogging', checked)}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="enable-metrics">Performance Metrics</Label>
              <p className="text-sm text-muted-foreground">
                Collect and display database performance metrics
              </p>
            </div>
            <Switch
              id="enable-metrics"
              checked={config.enableMetrics}
              onCheckedChange={(checked) => handleChange('enableMetrics', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Connection Status Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>Connection Status</span>
          </CardTitle>
          <CardDescription>
            Current database connection status and health
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Active Provider</Label>
              <div className="flex items-center space-x-2">
                <Badge variant="outline">{config.provider}</Badge>
                {getConnectionStatusBadge(
                  config.provider === 'astradb' 
                    ? config.astraDb.connectionStatus 
                    : config.provider === 'postgresql'
                    ? config.postgresql.connectionStatus
                    : config.mongodb.connectionStatus
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Pool Utilization</Label>
              <div className="space-y-1">
                <Progress value={65} className="h-2" />
                <p className="text-xs text-muted-foreground">6/10 connections active</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}