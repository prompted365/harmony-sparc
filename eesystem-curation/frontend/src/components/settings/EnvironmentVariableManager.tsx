import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card'
import { Input } from '../ui/Input'
import { Label } from '../ui/Label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select'
import { Switch } from '../ui/Switch'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Alert, AlertDescription } from '../ui/Alert'
import { Separator } from '../ui/Separator'
import { Textarea } from '../ui/Textarea'
import { 
  Plus, 
  Trash2, 
  Eye, 
  EyeOff, 
  Search, 
  Filter, 
  Download, 
  Upload, 
  Copy, 
  Check,
  AlertTriangle,
  Info,
  Settings,
  Database,
  Key,
  Rocket,
  Star
} from 'lucide-react'
import { EnvironmentVariable } from '../../types/settings'

interface EnvironmentVariableManagerProps {
  variables: EnvironmentVariable[]
  onChange: (variables: EnvironmentVariable[]) => void
  className?: string
}

interface FilterState {
  search: string
  environment: string
  category: string
  isSecret: boolean | null
  isRequired: boolean | null
}

export function EnvironmentVariableManager({ 
  variables, 
  onChange, 
  className 
}: EnvironmentVariableManagerProps) {
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})
  const [editingVar, setEditingVar] = useState<string | null>(null)
  const [copiedVar, setCopiedVar] = useState<string | null>(null)
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    environment: 'all',
    category: 'all',
    isSecret: null,
    isRequired: null
  })

  const [newVar, setNewVar] = useState<Partial<EnvironmentVariable>>({
    key: '',
    value: '',
    description: '',
    isRequired: false,
    isSecret: false,
    environment: 'all',
    category: 'other'
  })

  // Filter and search variables
  const filteredVariables = useMemo(() => {
    return variables.filter(variable => {
      if (filters.search && !variable.key.toLowerCase().includes(filters.search.toLowerCase()) &&
          !variable.description?.toLowerCase().includes(filters.search.toLowerCase())) {
        return false
      }

      if (filters.environment !== 'all' && variable.environment !== filters.environment) {
        return false
      }

      if (filters.category !== 'all' && variable.category !== filters.category) {
        return false
      }

      if (filters.isSecret !== null && variable.isSecret !== filters.isSecret) {
        return false
      }

      if (filters.isRequired !== null && variable.isRequired !== filters.isRequired) {
        return false
      }

      return true
    })
  }, [variables, filters])

  // Group variables by category
  const groupedVariables = useMemo(() => {
    const groups: Record<string, EnvironmentVariable[]> = {}
    filteredVariables.forEach(variable => {
      if (!groups[variable.category]) {
        groups[variable.category] = []
      }
      groups[variable.category].push(variable)
    })
    return groups
  }, [filteredVariables])

  const addVariable = () => {
    if (!newVar.key || !newVar.value) return

    const variable: EnvironmentVariable = {
      ...newVar,
      id: Date.now().toString()
    } as EnvironmentVariable

    onChange([...variables, variable])
    
    // Reset form
    setNewVar({
      key: '',
      value: '',
      description: '',
      isRequired: false,
      isSecret: false,
      environment: 'all',
      category: 'other'
    })
  }

  const updateVariable = (id: string, updates: Partial<EnvironmentVariable>) => {
    onChange(variables.map(variable => 
      variable.id === id ? { ...variable, ...updates } : variable
    ))
  }

  const removeVariable = (id: string) => {
    onChange(variables.filter(variable => variable.id !== id))
  }

  const duplicateVariable = (variable: EnvironmentVariable) => {
    const newVariable: EnvironmentVariable = {
      ...variable,
      id: Date.now().toString(),
      key: `${variable.key}_COPY`
    }
    onChange([...variables, newVariable])
  }

  const toggleSecretVisibility = (id: string) => {
    setShowSecrets(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedVar(id)
      setTimeout(() => setCopiedVar(null), 2000)
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
    }
  }

  const exportVariables = () => {
    const exportData = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      variables: filteredVariables
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `env-variables-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const importVariables = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const importData = JSON.parse(content)
        
        if (importData.variables && Array.isArray(importData.variables)) {
          const newVariables = importData.variables.map((v: any) => ({
            ...v,
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
          }))
          onChange([...variables, ...newVariables])
        }
      } catch (error) {
        console.error('Error importing variables:', error)
      }
    }
    reader.readAsText(file)
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'database': return <Database className="h-4 w-4" />
      case 'api': return <Key className="h-4 w-4" />
      case 'deployment': return <Rocket className="h-4 w-4" />
      case 'feature': return <Star className="h-4 w-4" />
      default: return <Settings className="h-4 w-4" />
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'database': return 'bg-blue-500'
      case 'api': return 'bg-green-500'
      case 'deployment': return 'bg-purple-500'
      case 'feature': return 'bg-yellow-500'
      default: return 'bg-gray-500'
    }
  }

  const validateVariable = (variable: Partial<EnvironmentVariable>) => {
    const errors: string[] = []
    
    if (!variable.key) {
      errors.push('Key is required')
    } else if (!/^[A-Z_][A-Z0-9_]*$/i.test(variable.key)) {
      errors.push('Key should only contain letters, numbers, and underscores')
    }

    if (variable.isRequired && !variable.value) {
      errors.push('Required variables cannot have empty values')
    }

    // Check for duplicates
    const existing = variables.find(v => v.key === variable.key && v.id !== variable.id)
    if (existing) {
      errors.push('Variable key already exists')
    }

    return errors
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Environment Variables</h3>
          <p className="text-sm text-muted-foreground">
            Manage environment variables for your application
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={exportVariables}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <div className="relative">
            <Button variant="outline" onClick={() => document.getElementById('import-env-vars')?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <input
              id="import-env-vars"
              type="file"
              accept=".json"
              className="hidden"
              onChange={importVariables}
            />
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filters</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search variables..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Environment</Label>
              <Select
                value={filters.environment}
                onValueChange={(value) => setFilters(prev => ({ ...prev, environment: value }))}
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
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={filters.category}
                onValueChange={(value) => setFilters(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="database">Database</SelectItem>
                  <SelectItem value="api">API</SelectItem>
                  <SelectItem value="deployment">Deployment</SelectItem>
                  <SelectItem value="feature">Feature</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={filters.isSecret === null ? 'all' : filters.isSecret ? 'secret' : 'public'}
                onValueChange={(value) => setFilters(prev => ({ 
                  ...prev, 
                  isSecret: value === 'all' ? null : value === 'secret' 
                }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="secret">Secret</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Required</Label>
              <Select
                value={filters.isRequired === null ? 'all' : filters.isRequired ? 'required' : 'optional'}
                onValueChange={(value) => setFilters(prev => ({ 
                  ...prev, 
                  isRequired: value === 'all' ? null : value === 'required' 
                }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="required">Required</SelectItem>
                  <SelectItem value="optional">Optional</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {filteredVariables.length} of {variables.length} variables
            </p>
            <Button
              variant="outline"
              onClick={() => setFilters({
                search: '',
                environment: 'all',
                category: 'all',
                isSecret: null,
                isRequired: null
              })}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Add New Variable */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Plus className="h-5 w-5" />
            <span>Add New Variable</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="new-var-key">Variable Key *</Label>
              <Input
                id="new-var-key"
                value={newVar.key}
                onChange={(e) => setNewVar(prev => ({ ...prev, key: e.target.value.toUpperCase() }))}
                placeholder="API_KEY"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-var-value">Value *</Label>
              <Input
                id="new-var-value"
                type={newVar.isSecret ? 'password' : 'text'}
                value={newVar.value}
                onChange={(e) => setNewVar(prev => ({ ...prev, value: e.target.value }))}
                placeholder="your-value-here"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-var-description">Description</Label>
            <Textarea
              id="new-var-description"
              value={newVar.description}
              onChange={(e) => setNewVar(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of this variable"
              rows={2}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="new-var-environment">Environment</Label>
              <Select
                value={newVar.environment}
                onValueChange={(value) => setNewVar(prev => ({ ...prev, environment: value as any }))}
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
            <div className="space-y-2">
              <Label htmlFor="new-var-category">Category</Label>
              <Select
                value={newVar.category}
                onValueChange={(value) => setNewVar(prev => ({ ...prev, category: value as any }))}
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
            <div className="space-y-2">
              <Label>Options</Label>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="new-var-secret"
                    checked={newVar.isSecret}
                    onCheckedChange={(checked) => setNewVar(prev => ({ ...prev, isSecret: checked }))}
                  />
                  <Label htmlFor="new-var-secret" className="text-sm">Secret</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="new-var-required"
                    checked={newVar.isRequired}
                    onCheckedChange={(checked) => setNewVar(prev => ({ ...prev, isRequired: checked }))}
                  />
                  <Label htmlFor="new-var-required" className="text-sm">Required</Label>
                </div>
              </div>
            </div>
          </div>
          
          {/* Validation Errors */}
          {newVar.key && validateVariable(newVar).length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside">
                  {validateVariable(newVar).map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <Button
            onClick={addVariable}
            disabled={!newVar.key || !newVar.value || validateVariable(newVar).length > 0}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Variable
          </Button>
        </CardContent>
      </Card>

      {/* Variables List */}
      <div className="space-y-4">
        {Object.keys(groupedVariables).map(category => (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                {getCategoryIcon(category)}
                <span className="capitalize">{category}</span>
                <Badge variant="outline">{groupedVariables[category].length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {groupedVariables[category].map(variable => (
                <Card key={variable.id} className="bg-muted/50">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center space-x-2">
                          <code className="text-sm font-mono bg-background px-2 py-1 rounded">
                            {variable.key}
                          </code>
                          <Badge variant="outline" className="text-xs">
                            {variable.environment}
                          </Badge>
                          {variable.isRequired && (
                            <Badge variant="destructive" className="text-xs">
                              Required
                            </Badge>
                          )}
                          {variable.isSecret && (
                            <Badge variant="secondary" className="text-xs">
                              Secret
                            </Badge>
                          )}
                        </div>
                        
                        {variable.description && (
                          <p className="text-sm text-muted-foreground">
                            {variable.description}
                          </p>
                        )}

                        <div className="flex items-center space-x-2">
                          <Input
                            type={variable.isSecret && !showSecrets[variable.id] ? 'password' : 'text'}
                            value={variable.value}
                            onChange={(e) => updateVariable(variable.id, { value: e.target.value })}
                            className="text-sm"
                            readOnly={editingVar !== variable.id}
                          />
                          <div className="flex items-center space-x-1">
                            {variable.isSecret && (
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => toggleSecretVisibility(variable.id)}
                              >
                                {showSecrets[variable.id] ? 
                                  <EyeOff className="h-3 w-3" /> : 
                                  <Eye className="h-3 w-3" />
                                }
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => copyToClipboard(variable.value, variable.id)}
                            >
                              {copiedVar === variable.id ? 
                                <Check className="h-3 w-3 text-green-500" /> : 
                                <Copy className="h-3 w-3" />
                              }
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => duplicateVariable(variable)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => removeVariable(variable.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        ))}

        {filteredVariables.length === 0 && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Settings className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No Variables Found</h3>
                <p className="text-muted-foreground mb-4">
                  {variables.length === 0 
                    ? 'No environment variables configured yet' 
                    : 'No variables match your current filters'
                  }
                </p>
                {variables.length === 0 && (
                  <Button onClick={() => document.getElementById('new-var-key')?.focus()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Variable
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Summary */}
      {variables.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Info className="h-5 w-5" />
              <span>Summary</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{variables.length}</p>
                <p className="text-sm text-muted-foreground">Total Variables</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{variables.filter(v => v.isRequired).length}</p>
                <p className="text-sm text-muted-foreground">Required</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{variables.filter(v => v.isSecret).length}</p>
                <p className="text-sm text-muted-foreground">Secret</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{variables.filter(v => v.environment === 'production').length}</p>
                <p className="text-sm text-muted-foreground">Production</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{new Set(variables.map(v => v.category)).size}</p>
                <p className="text-sm text-muted-foreground">Categories</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}