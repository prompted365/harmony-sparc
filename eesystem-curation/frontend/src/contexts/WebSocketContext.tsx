import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { WebSocketMessage, NotificationMessage } from '../types'
import webSocketService, { WebSocketEventHandlers } from '../services/websocket'

interface WebSocketContextType {
  isConnected: boolean
  connectionState: string
  notifications: NotificationMessage[]
  sendMessage: (type: string, data: any) => void
  addNotification: (notification: NotificationMessage) => void
  removeNotification: (id: string) => void
  clearNotifications: () => void
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined)

export const useWebSocket = () => {
  const context = useContext(WebSocketContext)
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider')
  }
  return context
}

interface WebSocketProviderProps {
  children: ReactNode
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false)
  const [connectionState, setConnectionState] = useState('disconnected')
  const [notifications, setNotifications] = useState<NotificationMessage[]>([])

  useEffect(() => {
    const handlers: WebSocketEventHandlers = {
      onConnect: () => {
        setIsConnected(true)
        setConnectionState('connected')
      },
      onDisconnect: () => {
        setIsConnected(false)
        setConnectionState('disconnected')
      },
      onNotification: (notification: NotificationMessage) => {
        setNotifications(prev => [notification, ...prev])
      },
      onError: (error: any) => {
        console.error('WebSocket error:', error)
        setConnectionState('error')
      },
      onMessage: (message: WebSocketMessage) => {
        // Handle any general message processing here
        console.log('WebSocket message received:', message)
      },
    }

    webSocketService.setHandlers(handlers)

    // Update connection state periodically
    const interval = setInterval(() => {
      setConnectionState(webSocketService.getConnectionState())
      setIsConnected(webSocketService.isConnected())
    }, 1000)

    return () => {
      clearInterval(interval)
    }
  }, [])

  const sendMessage = (type: string, data: any) => {
    webSocketService.send(type, data)
  }

  const addNotification = (notification: NotificationMessage) => {
    setNotifications(prev => [notification, ...prev])
  }

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const clearNotifications = () => {
    setNotifications([])
  }

  const value: WebSocketContextType = {
    isConnected,
    connectionState,
    notifications,
    sendMessage,
    addNotification,
    removeNotification,
    clearNotifications,
  }

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>
}

export default WebSocketProvider