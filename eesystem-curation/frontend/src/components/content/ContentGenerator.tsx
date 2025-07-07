import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Textarea } from '../ui/Textarea'
import { Badge } from '../ui/Badge'
import { Progress } from '../ui/Progress'
import { 
  Wand2, 
  Settings, 
  Copy, 
  Download, 
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { ContentType, GenerationParameters, Brand, AIAgent } from '../../types'
import { useContentGeneration } from '../../hooks/useContentGeneration'
import { useWebSocket } from '../../contexts/WebSocketContext'
import apiService from '../../services/api'
import * as Select from '@radix-ui/react-select'
import * as Switch from '@radix-ui/react-switch'

export const ContentGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState('')
  const [selectedType, setSelectedType] = useState<ContentType>('article')
  const [selectedBrand, setSelectedBrand] = useState<string>('')
  const [parameters, setParameters] = useState<GenerationParameters>({
    length: 'medium',
    tone: 'professional',
    style: 'informative',
    keywords: [],
    targetAudience: [],
    includeImages: false,
    includeSeo: true,
  })
  const [keywordInput, setKeywordInput] = useState('')
  const [audienceInput, setAudienceInput] = useState('')
  const [brands, setBrands] = useState<Brand[]>([])
  const [agents, setAgents] = useState<AIAgent[]>([])
  const [selectedAgent, setSelectedAgent] = useState<string>('')
  const [generatedContent, setGeneratedContent] = useState<string>('')
  const [generationProgress, setGenerationProgress] = useState(0)

  const { 
    generateContent, 
    loading, 
    error, 
    generations, 
    clearError 
  } = useContentGeneration()

  const { sendMessage } = useWebSocket()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [brandsData, agentsData] = await Promise.all([
        apiService.getBrands(),
        apiService.getAgents()
      ])
      setBrands(brandsData)
      setAgents(agentsData.filter(agent => agent.type === 'content-writer'))
      
      if (brandsData.length > 0) {
        setSelectedBrand(brandsData[0].id)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  const handleGenerate = async () => {
    if (!prompt.trim() || !selectedBrand) return

    clearError()
    setGenerationProgress(0)

    try {
      const result = await generateContent({
        type: selectedType,
        prompt: prompt.trim(),
        brandId: selectedBrand,
        parameters,
      })

      if (result) {
        // Simulate progress updates
        const progressInterval = setInterval(() => {
          setGenerationProgress(prev => {
            if (prev >= 90) {
              clearInterval(progressInterval)
              return prev
            }
            return prev + 10
          })
        }, 500)

        // Send WebSocket message to start generation tracking
        sendMessage('track-generation', { 
          generationId: result.id,
          agentId: selectedAgent 
        })
      }
    } catch (error) {
      console.error('Generation error:', error)
    }
  }

  const addKeyword = () => {
    if (keywordInput.trim() && !parameters.keywords.includes(keywordInput.trim())) {
      setParameters(prev => ({
        ...prev,
        keywords: [...prev.keywords, keywordInput.trim()]
      }))
      setKeywordInput('')
    }
  }

  const removeKeyword = (keyword: string) => {
    setParameters(prev => ({
      ...prev,
      keywords: prev.keywords.filter(k => k !== keyword)
    }))
  }

  const addAudience = () => {
    if (audienceInput.trim() && !parameters.targetAudience.includes(audienceInput.trim())) {
      setParameters(prev => ({
        ...prev,
        targetAudience: [...prev.targetAudience, audienceInput.trim()]
      }))
      setAudienceInput('')
    }
  }

  const removeAudience = (audience: string) => {
    setParameters(prev => ({
      ...prev,
      targetAudience: prev.targetAudience.filter(a => a !== audience)
    }))
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const downloadContent = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const contentTypes: { value: ContentType; label: string }[] = [
    { value: 'article', label: 'Article' },
    { value: 'social-post', label: 'Social Media Post' },
    { value: 'newsletter', label: 'Newsletter' },
    { value: 'press-release', label: 'Press Release' },
    { value: 'blog-post', label: 'Blog Post' },
    { value: 'product-description', label: 'Product Description' },
  ]

  const lengthOptions = [
    { value: 'short', label: 'Short (100-300 words)' },
    { value: 'medium', label: 'Medium (300-800 words)' },
    { value: 'long', label: 'Long (800+ words)' },
  ]

  const toneOptions = [
    'professional', 'casual', 'friendly', 'authoritative', 'conversational',
    'formal', 'humorous', 'inspirational', 'educational', 'persuasive'
  ]

  const styleOptions = [
    'informative', 'narrative', 'descriptive', 'analytical', 'creative',
    'technical', 'marketing', 'journalistic', 'academic', 'conversational'
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Content Generator</h1>
        <p className="text-muted-foreground">
          Generate high-quality content using AI agents
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Generator Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Wand2 className="h-5 w-5 mr-2" />
              Generate Content
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Content Type */}
            <div>
              <label className="text-sm font-medium mb-2 block">Content Type</label>
              <Select.Root value={selectedType} onValueChange={(value) => setSelectedType(value as ContentType)}>
                <Select.Trigger className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                  <Select.Value />
                  <Select.Icon />
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
                    <Select.Viewport className="p-1">
                      {contentTypes.map((type) => (
                        <Select.Item
                          key={type.value}
                          value={type.value}
                          className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                        >
                          <Select.ItemText>{type.label}</Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>

            {/* Brand Selection */}
            <div>
              <label className="text-sm font-medium mb-2 block">Brand</label>
              <Select.Root value={selectedBrand} onValueChange={setSelectedBrand}>
                <Select.Trigger className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                  <Select.Value placeholder="Select a brand" />
                  <Select.Icon />
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
                    <Select.Viewport className="p-1">
                      {brands.map((brand) => (
                        <Select.Item
                          key={brand.id}
                          value={brand.id}
                          className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                        >
                          <Select.ItemText>{brand.name}</Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>

            {/* AI Agent Selection */}
            <div>
              <label className="text-sm font-medium mb-2 block">AI Agent</label>
              <Select.Root value={selectedAgent} onValueChange={setSelectedAgent}>
                <Select.Trigger className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                  <Select.Value placeholder="Auto-select best agent" />
                  <Select.Icon />
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
                    <Select.Viewport className="p-1">
                      {agents.map((agent) => (
                        <Select.Item
                          key={agent.id}
                          value={agent.id}
                          className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                        >
                          <Select.ItemText>{agent.name}</Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>

            {/* Prompt */}
            <div>
              <label className="text-sm font-medium mb-2 block">Prompt</label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe what you want to generate..."
                className="min-h-[100px]"
              />
            </div>

            {/* Parameters */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium mb-2 block">Length</label>
                <Select.Root value={parameters.length} onValueChange={(value) => setParameters(prev => ({ ...prev, length: value as any }))}>
                  <Select.Trigger className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                    <Select.Value />
                    <Select.Icon />
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content className="relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
                      <Select.Viewport className="p-1">
                        {lengthOptions.map((option) => (
                          <Select.Item
                            key={option.value}
                            value={option.value}
                            className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                          >
                            <Select.ItemText>{option.label}</Select.ItemText>
                          </Select.Item>
                        ))}
                      </Select.Viewport>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Tone</label>
                <Select.Root value={parameters.tone} onValueChange={(value) => setParameters(prev => ({ ...prev, tone: value }))}>
                  <Select.Trigger className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                    <Select.Value />
                    <Select.Icon />
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content className="relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
                      <Select.Viewport className="p-1">
                        {toneOptions.map((tone) => (
                          <Select.Item
                            key={tone}
                            value={tone}
                            className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                          >
                            <Select.ItemText>{tone}</Select.ItemText>
                          </Select.Item>
                        ))}
                      </Select.Viewport>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
              </div>
            </div>

            {/* Keywords */}
            <div>
              <label className="text-sm font-medium mb-2 block">Keywords</label>
              <div className="flex space-x-2 mb-2">
                <Input
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  placeholder="Add keyword"
                  onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
                />
                <Button onClick={addKeyword} size="sm">Add</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {parameters.keywords.map((keyword, index) => (
                  <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeKeyword(keyword)}>
                    {keyword} ×
                  </Badge>
                ))}
              </div>
            </div>

            {/* Options */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Include SEO optimization</label>
                <Switch.Root
                  checked={parameters.includeSeo}
                  onCheckedChange={(checked) => setParameters(prev => ({ ...prev, includeSeo: checked }))}
                  className="w-11 h-6 bg-gray-200 rounded-full relative data-[state=checked]:bg-primary outline-none cursor-pointer"
                >
                  <Switch.Thumb className="block w-5 h-5 bg-white rounded-full shadow-md transform transition-transform data-[state=checked]:translate-x-5" />
                </Switch.Root>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Include image suggestions</label>
                <Switch.Root
                  checked={parameters.includeImages}
                  onCheckedChange={(checked) => setParameters(prev => ({ ...prev, includeImages: checked }))}
                  className="w-11 h-6 bg-gray-200 rounded-full relative data-[state=checked]:bg-primary outline-none cursor-pointer"
                >
                  <Switch.Thumb className="block w-5 h-5 bg-white rounded-full shadow-md transform transition-transform data-[state=checked]:translate-x-5" />
                </Switch.Root>
              </div>
            </div>

            {/* Generate Button */}
            <Button 
              onClick={handleGenerate} 
              disabled={!prompt.trim() || !selectedBrand || loading}
              className="w-full"
              variant="brand"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Generate Content
                </>
              )}
            </Button>

            {/* Progress */}
            {loading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Generating content...</span>
                  <span>{generationProgress}%</span>
                </div>
                <Progress value={generationProgress} />
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div className="flex items-center text-destructive">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  <span className="text-sm font-medium">Generation Error</span>
                </div>
                <p className="text-sm text-destructive mt-1">{error}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader>
            <CardTitle>Generated Content</CardTitle>
          </CardHeader>
          <CardContent>
            {generations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Wand2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No content generated yet</p>
                <p className="text-sm">Use the form to generate your first piece of content</p>
              </div>
            ) : (
              <div className="space-y-4">
                {generations.map((generation) => (
                  <div key={generation.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant={generation.status === 'completed' ? 'success' : 'secondary'}>
                        {generation.status}
                      </Badge>
                      <div className="flex space-x-2">
                        {generation.result && (
                          <>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => copyToClipboard(generation.result!)}
                            >
                              <Copy className="h-4 w-4 mr-1" />
                              Copy
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => downloadContent(generation.result!, `${generation.type}-${generation.id}.txt`)}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              Download
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">{generation.type}</p>
                      <p className="text-sm text-muted-foreground">{generation.prompt}</p>
                      {generation.result && (
                        <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                          <pre className="text-sm whitespace-pre-wrap">{generation.result}</pre>
                        </div>
                      )}
                      {generation.error && (
                        <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                          <p className="text-sm text-destructive">{generation.error}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}