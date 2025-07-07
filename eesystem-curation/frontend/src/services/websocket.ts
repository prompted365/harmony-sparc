import { WebSocketMessage, NotificationMessage } from '../types'

export type WebSocketEventType = 
  | 'content-generated'
  | 'agent-status-change'
  | 'content-published'
  | 'file-processed'
  | 'analytics-update'
  | 'notification'
  | 'error'

export interface WebSocketEventHandlers {
  onMessage?: (message: WebSocketMessage) => void
  onContentGenerated?: (content: any) => void
  onAgentStatusChange?: (agent: any) => void
  onContentPublished?: (content: any) => void
  onFileProcessed?: (file: any) => void
  onAnalyticsUpdate?: (analytics: any) => void
  onNotification?: (notification: NotificationMessage) => void
  onError?: (error: any) => void
  onConnect?: () => void
  onDisconnect?: () => void
}

class WebSocketService {
  private ws: WebSocket | null = null
  private handlers: WebSocketEventHandlers = {}
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private isReconnecting = false

  constructor() {
    this.connect()
  }

  private connect() {
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001'
    const token = localStorage.getItem('auth-token')
    
    try {
      this.ws = new WebSocket(`${wsUrl}?token=${token}`)
      
      this.ws.onopen = () => {
        console.log('WebSocket connected')
        this.reconnectAttempts = 0
        this.isReconnecting = false
        this.handlers.onConnect?.()
      }

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          this.handleMessage(message)
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }

      this.ws.onclose = () => {
        console.log('WebSocket disconnected')
        this.handlers.onDisconnect?.()
        this.handleReconnect()
      }

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        this.handlers.onError?.(error)
      }
    } catch (error) {
      console.error('Error creating WebSocket connection:', error)
      this.handleReconnect()
    }
  }

  private handleMessage(message: WebSocketMessage) {
    // Call general message handler
    this.handlers.onMessage?.(message)

    // Call specific handlers based on message type
    switch (message.type) {
      case 'content-generated':
        this.handlers.onContentGenerated?.(message.data)
        break
      case 'agent-status-change':
        this.handlers.onAgentStatusChange?.(message.data)
        break
      case 'content-published':
        this.handlers.onContentPublished?.(message.data)
        break
      case 'file-processed':
        this.handlers.onFileProcessed?.(message.data)
        break
      case 'analytics-update':
        this.handlers.onAnalyticsUpdate?.(message.data)
        break
      case 'notification':
        this.handlers.onNotification?.(message.data)
        break
      case 'error':
        this.handlers.onError?.(message.data)
        break
    }
  }

  private handleReconnect() {
    if (this.isReconnecting || this.reconnectAttempts >= this.maxReconnectAttempts) {
      return
    }

    this.isReconnecting = true
    this.reconnectAttempts++

    setTimeout(() => {
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
      this.connect()
    }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1))
  }

  public setHandlers(handlers: WebSocketEventHandlers) {
    this.handlers = { ...this.handlers, ...handlers }
  }

  public send(type: string, data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message: WebSocketMessage = {
        type,
        data,
        timestamp: new Date()
      }
      this.ws.send(JSON.stringify(message))
    } else {
      console.warn('WebSocket is not connected')
    }
  }

  public disconnect() {
    this.maxReconnectAttempts = 0 // Prevent reconnection
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  public getConnectionState(): string {
    if (!this.ws) return 'disconnected'
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting'
      case WebSocket.OPEN:
        return 'connected'
      case WebSocket.CLOSING:
        return 'closing'
      case WebSocket.CLOSED:
        return 'disconnected'
      default:
        return 'unknown'
    }
  }
}

export const webSocketService = new WebSocketService()
export default webSocketService