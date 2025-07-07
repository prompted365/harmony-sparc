import React from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { NotificationCenter } from '../notifications/NotificationCenter'
import { useAuth } from '../../contexts/AuthContext'
import { useWebSocket } from '../../contexts/WebSocketContext'

interface LayoutProps {
  children: React.ReactNode
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { isAuthenticated } = useAuth()
  const { connectionState } = useWebSocket()

  if (!isAuthenticated) {
    return <div className="min-h-screen bg-background">{children}</div>
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex h-[calc(100vh-64px)]">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
      <NotificationCenter />
      
      {/* Connection Status Indicator */}
      {connectionState !== 'connected' && (
        <div className="fixed bottom-4 right-4 bg-yellow-500 text-white px-4 py-2 rounded-md shadow-lg">
          {connectionState === 'connecting' && 'Connecting...'}
          {connectionState === 'disconnected' && 'Disconnected'}
          {connectionState === 'error' && 'Connection Error'}
        </div>
      )}
    </div>
  )
}