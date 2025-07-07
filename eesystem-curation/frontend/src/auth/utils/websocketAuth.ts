import { AuthUser, AuthTokens } from '../types'
import { tokenUtils } from './tokenUtils'

export interface AuthenticatedWebSocket extends WebSocket {
  isAuthenticated?: boolean
  userId?: string
  lastPing?: number
}

export interface WebSocketAuthMessage {
  type: 'auth' | 'auth_success' | 'auth_error' | 'ping' | 'pong'
  token?: string
  user?: AuthUser
  error?: string
  timestamp?: number
}

export class WebSocketAuthManager {
  private ws: AuthenticatedWebSocket | null = null
  private pingInterval: NodeJS.Timeout | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private heartbeatInterval = 30000 // 30 seconds

  constructor(
    private url: string,
    private onMessage?: (message: any) => void,
    private onStateChange?: (state: 'connecting' | 'connected' | 'disconnected' | 'error') => void
  ) {}

  /**
   * Connect to WebSocket with authentication
   */
  async connect(tokens?: AuthTokens): Promise<void> {
    try {
      this.onStateChange?.('connecting')
      
      // Get tokens if not provided
      const authTokens = tokens || tokenUtils.getTokens()
      if (!authTokens || tokenUtils.isTokenExpired()) {
        throw new Error('No valid authentication tokens available')
      }

      // Create WebSocket connection
      this.ws = new WebSocket(this.url) as AuthenticatedWebSocket

      this.setupEventListeners()
      
      // Wait for connection to open
      await new Promise<void>((resolve, reject) => {
        if (!this.ws) return reject(new Error('WebSocket not initialized'))

        this.ws.onopen = () => {
          this.sendAuthMessage(authTokens.accessToken)
          resolve()
        }

        this.ws.onerror = (error) => {
          reject(new Error('WebSocket connection failed'))
        }

        // Timeout after 10 seconds
        setTimeout(() => reject(new Error('Connection timeout')), 10000)
      })

    } catch (error) {
      console.error('WebSocket connection error:', error)
      this.onStateChange?.('error')
      throw error
    }
  }

  /**
   * Disconnect WebSocket
   */
  disconnect(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    this.onStateChange?.('disconnected')
  }

  /**
   * Send message through authenticated WebSocket
   */
  send(message: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected')
    }

    if (!this.ws.isAuthenticated) {
      throw new Error('WebSocket is not authenticated')
    }

    this.ws.send(JSON.stringify(message))
  }

  /**
   * Check if WebSocket is connected and authenticated
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.ws.isAuthenticated === true
  }

  /**
   * Get current connection state
   */
  getState(): 'connecting' | 'connected' | 'disconnected' | 'error' {
    if (!this.ws) return 'disconnected'
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting'
      case WebSocket.OPEN:
        return this.ws.isAuthenticated ? 'connected' : 'connecting'
      case WebSocket.CLOSING:
      case WebSocket.CLOSED:
        return 'disconnected'
      default:
        return 'error'
    }
  }

  /**
   * Setup WebSocket event listeners
   */
  private setupEventListeners(): void {
    if (!this.ws) return

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketAuthMessage = JSON.parse(event.data)
        this.handleAuthMessage(message)
      } catch (error) {
        console.error('Error parsing WebSocket message:', error)
      }
    }

    this.ws.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason)
      this.ws!.isAuthenticated = false
      
      if (this.pingInterval) {
        clearInterval(this.pingInterval)
        this.pingInterval = null
      }

      // Attempt reconnection if not a clean close
      if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.attemptReconnect()
      } else {
        this.onStateChange?.('disconnected')
      }
    }

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      this.onStateChange?.('error')
    }
  }

  /**
   * Send authentication message
   */
  private sendAuthMessage(token: string): void {
    if (!this.ws) return

    const authMessage: WebSocketAuthMessage = {
      type: 'auth',
      token,
      timestamp: Date.now()
    }

    this.ws.send(JSON.stringify(authMessage))
  }

  /**
   * Handle authentication-related messages
   */
  private handleAuthMessage(message: WebSocketAuthMessage): void {
    switch (message.type) {
      case 'auth_success':
        if (this.ws) {
          this.ws.isAuthenticated = true
          this.ws.userId = message.user?.id
          this.startHeartbeat()
          this.reconnectAttempts = 0
          this.onStateChange?.('connected')
        }
        break

      case 'auth_error':
        console.error('WebSocket authentication failed:', message.error)
        this.ws?.close()
        break

      case 'ping':
        this.sendPong()
        break

      case 'pong':
        if (this.ws) {
          this.ws.lastPing = Date.now()
        }
        break

      default:
        // Pass non-auth messages to the application handler
        this.onMessage?.(message)
        break
    }
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
    }

    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.sendPing()
      }
    }, this.heartbeatInterval)
  }

  /**
   * Send ping message
   */
  private sendPing(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return

    const pingMessage: WebSocketAuthMessage = {
      type: 'ping',
      timestamp: Date.now()
    }

    this.ws.send(JSON.stringify(pingMessage))
  }

  /**
   * Send pong response
   */
  private sendPong(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return

    const pongMessage: WebSocketAuthMessage = {
      type: 'pong',
      timestamp: Date.now()
    }

    this.ws.send(JSON.stringify(pongMessage))
  }

  /**
   * Attempt to reconnect
   */
  private async attemptReconnect(): Promise<void> {
    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1) // Exponential backoff

    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`)

    setTimeout(async () => {
      try {
        await this.connect()
      } catch (error) {
        console.error('Reconnection failed:', error)
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error('Max reconnection attempts reached')
          this.onStateChange?.('error')
        }
      }
    }, delay)
  }

  /**
   * Reauthenticate with new tokens
   */
  async reauthenticate(tokens: AuthTokens): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // If not connected, establish new connection
      await this.connect(tokens)
      return
    }

    // Send new auth message
    this.ws.isAuthenticated = false
    this.sendAuthMessage(tokens.accessToken)

    // Wait for authentication response
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Reauthentication timeout'))
      }, 5000)

      const originalHandler = this.handleAuthMessage.bind(this)
      this.handleAuthMessage = (message: WebSocketAuthMessage) => {
        if (message.type === 'auth_success') {
          clearTimeout(timeout)
          this.handleAuthMessage = originalHandler
          resolve()
        } else if (message.type === 'auth_error') {
          clearTimeout(timeout)
          this.handleAuthMessage = originalHandler
          reject(new Error(message.error || 'Reauthentication failed'))
        }
        originalHandler(message)
      }
    })
  }
}

// Global WebSocket auth manager instance
let globalWSManager: WebSocketAuthManager | null = null

/**
 * Get or create global WebSocket auth manager
 */
export function getWebSocketAuthManager(
  url?: string,
  onMessage?: (message: any) => void,
  onStateChange?: (state: 'connecting' | 'connected' | 'disconnected' | 'error') => void
): WebSocketAuthManager {
  if (!globalWSManager && url) {
    globalWSManager = new WebSocketAuthManager(url, onMessage, onStateChange)
  }
  
  if (!globalWSManager) {
    throw new Error('WebSocket auth manager not initialized. Provide URL on first call.')
  }
  
  return globalWSManager
}

/**
 * Cleanup global WebSocket manager
 */
export function cleanupWebSocketAuth(): void {
  if (globalWSManager) {
    globalWSManager.disconnect()
    globalWSManager = null
  }
}

export default WebSocketAuthManager