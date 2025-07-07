import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'
import { 
  User, 
  Brand, 
  Content, 
  AIAgent, 
  UploadedFile, 
  ContentGeneration, 
  Analytics 
} from '../types'
import { astraDBService } from '../lib/astradb'
import { ContentDocument, UserDocument, BrandDocument } from '../types/astradb'

class ApiService {
  private api: AxiosInstance
  private useAstraDB: boolean = true

  constructor() {
    this.api = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Request interceptor for auth
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('auth-token')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('auth-token')
          window.location.href = '/login'
        }
        return Promise.reject(error)
      }
    )

    // Initialize AstraDB service
    this.initializeAstraDB()
  }

  private async initializeAstraDB(): Promise<void> {
    try {
      if (!astraDBService.isInitialized()) {
        await astraDBService.initialize()
      }
      this.useAstraDB = true
    } catch (error) {
      console.warn('AstraDB initialization failed, falling back to API endpoints:', error)
      this.useAstraDB = false
    }
  }

  private convertContentToAstraDB(content: Omit<Content, 'id' | 'createdAt' | 'updatedAt'>): Omit<ContentDocument, '_id'> {
    return {
      title: content.title,
      type: content.type,
      status: content.status,
      content: content.content,
      metadata: content.metadata,
      generatedBy: content.generatedBy,
      tags: content.tags,
      brandId: content.brandId,
      publishedAt: content.publishedAt,
      scheduledFor: content.scheduledFor,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1
    }
  }

  private convertAstraDBToContent(doc: ContentDocument): Content {
    return {
      id: doc._id,
      title: doc.title,
      type: doc.type as any,
      status: doc.status as any,
      content: doc.content,
      metadata: doc.metadata,
      generatedBy: doc.generatedBy,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      publishedAt: doc.publishedAt,
      scheduledFor: doc.scheduledFor,
      tags: doc.tags,
      brandId: doc.brandId
    }
  }

  // Auth endpoints
  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    const response = await this.api.post('/auth/login', { email, password })
    return response.data
  }

  async logout(): Promise<void> {
    await this.api.post('/auth/logout')
    localStorage.removeItem('auth-token')
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.api.get('/auth/me')
    return response.data
  }

  // Brand endpoints
  async getBrands(): Promise<Brand[]> {
    const response = await this.api.get('/brands')
    return response.data
  }

  async getBrand(id: string): Promise<Brand> {
    const response = await this.api.get(`/brands/${id}`)
    return response.data
  }

  async createBrand(brand: Omit<Brand, 'id'>): Promise<Brand> {
    const response = await this.api.post('/brands', brand)
    return response.data
  }

  async updateBrand(id: string, brand: Partial<Brand>): Promise<Brand> {
    const response = await this.api.put(`/brands/${id}`, brand)
    return response.data
  }

  async deleteBrand(id: string): Promise<void> {
    await this.api.delete(`/brands/${id}`)
  }

  // Content endpoints
  async getContent(params?: { 
    brandId?: string
    type?: string
    status?: string
    limit?: number
    offset?: number
  }): Promise<{ items: Content[]; total: number }> {
    if (this.useAstraDB && astraDBService.isInitialized()) {
      try {
        const items = await astraDBService.getContentByBrand(
          params?.brandId || '',
          {
            status: params?.status,
            type: params?.type,
            limit: params?.limit,
            offset: params?.offset
          }
        )
        
        return {
          items: items.map(item => this.convertAstraDBToContent(item)),
          total: items.length
        }
      } catch (error) {
        console.warn('AstraDB getContent failed, falling back to API:', error)
      }
    }

    const response = await this.api.get('/content', { params })
    return response.data
  }

  async getContentById(id: string): Promise<Content> {
    if (this.useAstraDB && astraDBService.isInitialized()) {
      try {
        const content = await astraDBService.getContent(id)
        if (content) {
          return this.convertAstraDBToContent(content)
        }
      } catch (error) {
        console.warn('AstraDB getContentById failed, falling back to API:', error)
      }
    }

    const response = await this.api.get(`/content/${id}`)
    return response.data
  }

  async createContent(content: Omit<Content, 'id' | 'createdAt' | 'updatedAt'>): Promise<Content> {
    if (this.useAstraDB && astraDBService.isInitialized()) {
      try {
        const astraContent = this.convertContentToAstraDB(content)
        const created = await astraDBService.createContent(astraContent)
        if (created) {
          return this.convertAstraDBToContent(created)
        }
      } catch (error) {
        console.warn('AstraDB createContent failed, falling back to API:', error)
      }
    }

    const response = await this.api.post('/content', content)
    return response.data
  }

  async updateContent(id: string, content: Partial<Content>): Promise<Content> {
    if (this.useAstraDB && astraDBService.isInitialized()) {
      try {
        const updated = await astraDBService.updateContent(id, content as any)
        if (updated) {
          return this.convertAstraDBToContent(updated)
        }
      } catch (error) {
        console.warn('AstraDB updateContent failed, falling back to API:', error)
      }
    }

    const response = await this.api.put(`/content/${id}`, content)
    return response.data
  }

  async deleteContent(id: string): Promise<void> {
    if (this.useAstraDB && astraDBService.isInitialized()) {
      try {
        const deleted = await astraDBService.deleteContent(id)
        if (deleted) {
          return
        }
      } catch (error) {
        console.warn('AstraDB deleteContent failed, falling back to API:', error)
      }
    }

    await this.api.delete(`/content/${id}`)
  }

  async publishContent(id: string, scheduledFor?: Date): Promise<Content> {
    const response = await this.api.post(`/content/${id}/publish`, { scheduledFor })
    return response.data
  }

  async generateContent(params: {
    type: string
    prompt: string
    brandId: string
    parameters: any
  }): Promise<ContentGeneration> {
    const response = await this.api.post('/content/generate', params)
    return response.data
  }

  // AI Agent endpoints
  async getAgents(): Promise<AIAgent[]> {
    const response = await this.api.get('/agents')
    return response.data
  }

  async getAgent(id: string): Promise<AIAgent> {
    const response = await this.api.get(`/agents/${id}`)
    return response.data
  }

  async updateAgent(id: string, agent: Partial<AIAgent>): Promise<AIAgent> {
    const response = await this.api.put(`/agents/${id}`, agent)
    return response.data
  }

  async startAgent(id: string): Promise<AIAgent> {
    const response = await this.api.post(`/agents/${id}/start`)
    return response.data
  }

  async stopAgent(id: string): Promise<AIAgent> {
    const response = await this.api.post(`/agents/${id}/stop`)
    return response.data
  }

  async pauseAgent(id: string): Promise<AIAgent> {
    const response = await this.api.post(`/agents/${id}/pause`)
    return response.data
  }

  // File upload endpoints
  async uploadFile(file: File, onProgress?: (progress: number) => void): Promise<UploadedFile> {
    const formData = new FormData()
    formData.append('file', file)

    const config: AxiosRequestConfig = {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = (progressEvent.loaded / progressEvent.total) * 100
          onProgress(progress)
        }
      },
    }

    const response = await this.api.post('/files/upload', formData, config)
    return response.data
  }

  async getFiles(): Promise<UploadedFile[]> {
    const response = await this.api.get('/files')
    return response.data
  }

  async deleteFile(id: string): Promise<void> {
    await this.api.delete(`/files/${id}`)
  }

  // Analytics endpoints
  async getAnalytics(params?: {
    brandId?: string
    timeRange?: string
    contentType?: string
  }): Promise<Analytics> {
    const response = await this.api.get('/analytics', { params })
    return response.data
  }

  async getContentPerformance(contentId: string): Promise<any> {
    const response = await this.api.get(`/analytics/content/${contentId}`)
    return response.data
  }

  async getAgentMetrics(agentId?: string): Promise<any> {
    const response = await this.api.get('/analytics/agents', { 
      params: agentId ? { agentId } : undefined 
    })
    return response.data
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: Date; astradb?: any }> {
    try {
      // Check AstraDB health if available
      let astradbHealth = null
      if (this.useAstraDB && astraDBService.isInitialized()) {
        astradbHealth = await astraDBService.getSystemHealth()
      }

      const response = await this.api.get('/health')
      return {
        ...response.data,
        astradb: astradbHealth
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        error: (error as Error).message
      }
    }
  }

  // AstraDB specific methods
  async searchContent(query: string, options?: {
    brandId?: string
    type?: string
    limit?: number
  }): Promise<Content[]> {
    if (this.useAstraDB && astraDBService.isInitialized()) {
      try {
        const keywords = query.split(' ').filter(word => word.length > 2)
        const results = await astraDBService.searchContentByKeywords(keywords, options)
        return results.map(item => this.convertAstraDBToContent(item))
      } catch (error) {
        console.warn('AstraDB search failed:', error)
      }
    }

    // Fallback to API search if available
    try {
      const response = await this.api.get('/content/search', { 
        params: { q: query, ...options } 
      })
      return response.data
    } catch (error) {
      console.warn('API search not available')
      return []
    }
  }

  async getRelatedContent(contentId: string, limit: number = 5): Promise<Content[]> {
    if (this.useAstraDB && astraDBService.isInitialized()) {
      try {
        const contentOps = astraDBService.getContentOperations()
        if (contentOps) {
          const results = await contentOps.getRelatedContent(contentId, limit)
          return results.map(item => this.convertAstraDBToContent(item))
        }
      } catch (error) {
        console.warn('AstraDB getRelatedContent failed:', error)
      }
    }

    try {
      const response = await this.api.get(`/content/${contentId}/related`, {
        params: { limit }
      })
      return response.data
    } catch (error) {
      return []
    }
  }

  async getAstraDBStatus(): Promise<any> {
    if (this.useAstraDB && astraDBService.isInitialized()) {
      return await astraDBService.getSystemHealth()
    }
    return { status: 'not_initialized' }
  }
}

export const apiService = new ApiService()
export default apiService