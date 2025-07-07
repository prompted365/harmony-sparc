import React from 'react'
import { Bell, Search, Settings, User, LogOut } from 'lucide-react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { useAuth } from '../../contexts/AuthContext'
import { useWebSocket } from '../../contexts/WebSocketContext'
import { Badge } from '../ui/Badge'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'

export const Header: React.FC = () => {
  const { user, logout } = useAuth()
  const { notifications, isConnected } = useWebSocket()
  const unreadCount = notifications.filter(n => !n.read).length

  const handleLogout = async () => {
    await logout()
  }

  return (
    <header className="h-16 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-between px-6 h-full">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 brand-gradient rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">EE</span>
            </div>
            <h1 className="text-xl font-bold brand-text">EESystem</h1>
          </div>
          
          <div className="hidden md:flex items-center space-x-2">
            <div className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm text-muted-foreground">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 max-w-xl mx-8 hidden md:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search content, agents, or brands..."
              className="pl-10"
            />
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center text-xs">
                {unreadCount}
              </Badge>
            )}
          </Button>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button variant="ghost" size="icon">
                <User className="h-5 w-5" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="bg-popover border border-border rounded-md shadow-lg p-1 min-w-[200px]">
                <DropdownMenu.Item className="flex items-center px-3 py-2 text-sm hover:bg-accent rounded-sm cursor-pointer">
                  <User className="h-4 w-4 mr-2" />
                  Profile
                </DropdownMenu.Item>
                <DropdownMenu.Item className="flex items-center px-3 py-2 text-sm hover:bg-accent rounded-sm cursor-pointer">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="h-px bg-border my-1" />
                <DropdownMenu.Item 
                  className="flex items-center px-3 py-2 text-sm hover:bg-accent rounded-sm cursor-pointer text-destructive"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>
    </header>
  )
}