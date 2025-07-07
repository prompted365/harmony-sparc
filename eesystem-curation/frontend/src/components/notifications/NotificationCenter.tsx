import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { 
  Bell, 
  X, 
  Check, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  Info, 
  AlertTriangle,
  Settings
} from 'lucide-react'
import { useWebSocket } from '../../contexts/WebSocketContext'
import { formatDateTime } from '../../lib/utils'
import * as Dialog from '@radix-ui/react-dialog'
import * as Switch from '@radix-ui/react-switch'

export const NotificationCenter: React.FC = () => {
  const { 
    notifications, 
    removeNotification, 
    clearNotifications 
  } = useWebSocket()
  
  const [showCenter, setShowCenter] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [notificationSettings, setNotificationSettings] = useState({
    contentGenerated: true,
    agentStatusChange: true,
    contentPublished: true,
    fileProcessed: true,
    analyticsUpdate: false,
    systemAlerts: true,
    emailNotifications: false,
    pushNotifications: true,
    soundEnabled: true,
  })

  const unreadCount = notifications.filter(n => !n.read).length

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case 'info':
        return <Info className="h-5 w-5 text-blue-500" />
      default:
        return <Bell className="h-5 w-5 text-muted-foreground" />
    }
  }

  const getNotificationBgColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800'
      case 'error':
        return 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800'
      case 'info':
        return 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800'
      default:
        return 'bg-muted/50 border-border'
    }
  }

  const markAsRead = (notificationId: string) => {
    // Implementation would update the notification's read status
    console.log('Mark as read:', notificationId)
  }

  const markAllAsRead = () => {
    notifications.forEach(notification => {
      if (!notification.read) {
        markAsRead(notification.id)
      }
    })
  }

  return (
    <>
      {/* Notification Bell Button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90"
        onClick={() => setShowCenter(true)}
      >
        <Bell className="h-6 w-6" />
        {unreadCount > 0 && (
          <Badge variant="destructive" className="absolute -top-2 -right-2 h-6 w-6 flex items-center justify-center text-xs">
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>

      {/* Notification Center Dialog */}
      <Dialog.Root open={showCenter} onOpenChange={setShowCenter}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-background border border-border rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-border">
                <div className="flex items-center space-x-2">
                  <Dialog.Title className="text-lg font-semibold">
                    Notifications
                  </Dialog.Title>
                  {unreadCount > 0 && (
                    <Badge variant="secondary">
                      {unreadCount} unread
                    </Badge>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSettings(true)}
                  >
                    <Settings className="h-4 w-4 mr-1" />
                    Settings
                  </Button>
                  {unreadCount > 0 && (
                    <Button variant="outline" size="sm" onClick={markAllAsRead}>
                      <Check className="h-4 w-4 mr-1" />
                      Mark all read
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={clearNotifications}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Clear all
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setShowCenter(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Notifications List */}
              <div className="flex-1 overflow-y-auto p-6">
                {notifications.length === 0 ? (
                  <div className="text-center py-12">
                    <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h3 className="text-lg font-medium mb-2">No notifications</h3>
                    <p className="text-muted-foreground">
                      You're all caught up! Notifications will appear here when you have new activity.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-4 rounded-lg border transition-opacity ${
                          notification.read ? 'opacity-60' : ''
                        } ${getNotificationBgColor(notification.type)}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3 flex-1">
                            <div className="flex-shrink-0 mt-0.5">
                              {getNotificationIcon(notification.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <h4 className="text-sm font-medium">{notification.title}</h4>
                                {!notification.read && (
                                  <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">
                                {notification.message}
                              </p>
                              <div className="flex items-center justify-between">
                                <p className="text-xs text-muted-foreground">
                                  {formatDateTime(notification.timestamp)}
                                </p>
                                {notification.actionUrl && (
                                  <Button variant="link" size="sm" className="h-auto p-0 text-xs">
                                    View details
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-1 ml-2">
                            {!notification.read && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => markAsRead(notification.id)}
                                className="h-8 w-8 p-0"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeNotification(notification.id)}
                              className="h-8 w-8 p-0"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Settings Dialog */}
      <Dialog.Root open={showSettings} onOpenChange={setShowSettings}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-background border border-border rounded-lg p-6 w-full max-w-md">
            <Dialog.Title className="text-lg font-semibold mb-4">
              Notification Settings
            </Dialog.Title>
            
            <div className="space-y-4">
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Event Notifications</h3>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm">Content generated</label>
                    <Switch.Root
                      checked={notificationSettings.contentGenerated}
                      onCheckedChange={(checked) => 
                        setNotificationSettings(prev => ({ ...prev, contentGenerated: checked }))
                      }
                      className="w-11 h-6 bg-gray-200 rounded-full relative data-[state=checked]:bg-primary outline-none cursor-pointer"
                    >
                      <Switch.Thumb className="block w-5 h-5 bg-white rounded-full shadow-md transform transition-transform data-[state=checked]:translate-x-5" />
                    </Switch.Root>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <label className="text-sm">Agent status changes</label>
                    <Switch.Root
                      checked={notificationSettings.agentStatusChange}
                      onCheckedChange={(checked) => 
                        setNotificationSettings(prev => ({ ...prev, agentStatusChange: checked }))
                      }
                      className="w-11 h-6 bg-gray-200 rounded-full relative data-[state=checked]:bg-primary outline-none cursor-pointer"
                    >
                      <Switch.Thumb className="block w-5 h-5 bg-white rounded-full shadow-md transform transition-transform data-[state=checked]:translate-x-5" />
                    </Switch.Root>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <label className="text-sm">Content published</label>
                    <Switch.Root
                      checked={notificationSettings.contentPublished}
                      onCheckedChange={(checked) => 
                        setNotificationSettings(prev => ({ ...prev, contentPublished: checked }))
                      }
                      className="w-11 h-6 bg-gray-200 rounded-full relative data-[state=checked]:bg-primary outline-none cursor-pointer"
                    >
                      <Switch.Thumb className="block w-5 h-5 bg-white rounded-full shadow-md transform transition-transform data-[state=checked]:translate-x-5" />
                    </Switch.Root>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <label className="text-sm">File processed</label>
                    <Switch.Root
                      checked={notificationSettings.fileProcessed}
                      onCheckedChange={(checked) => 
                        setNotificationSettings(prev => ({ ...prev, fileProcessed: checked }))
                      }
                      className="w-11 h-6 bg-gray-200 rounded-full relative data-[state=checked]:bg-primary outline-none cursor-pointer"
                    >
                      <Switch.Thumb className="block w-5 h-5 bg-white rounded-full shadow-md transform transition-transform data-[state=checked]:translate-x-5" />
                    </Switch.Root>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <label className="text-sm">System alerts</label>
                    <Switch.Root
                      checked={notificationSettings.systemAlerts}
                      onCheckedChange={(checked) => 
                        setNotificationSettings(prev => ({ ...prev, systemAlerts: checked }))
                      }
                      className="w-11 h-6 bg-gray-200 rounded-full relative data-[state=checked]:bg-primary outline-none cursor-pointer"
                    >
                      <Switch.Thumb className="block w-5 h-5 bg-white rounded-full shadow-md transform transition-transform data-[state=checked]:translate-x-5" />
                    </Switch.Root>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-sm font-medium mb-3">Delivery Methods</h3>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm">Push notifications</label>
                    <Switch.Root
                      checked={notificationSettings.pushNotifications}
                      onCheckedChange={(checked) => 
                        setNotificationSettings(prev => ({ ...prev, pushNotifications: checked }))
                      }
                      className="w-11 h-6 bg-gray-200 rounded-full relative data-[state=checked]:bg-primary outline-none cursor-pointer"
                    >
                      <Switch.Thumb className="block w-5 h-5 bg-white rounded-full shadow-md transform transition-transform data-[state=checked]:translate-x-5" />
                    </Switch.Root>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <label className="text-sm">Email notifications</label>
                    <Switch.Root
                      checked={notificationSettings.emailNotifications}
                      onCheckedChange={(checked) => 
                        setNotificationSettings(prev => ({ ...prev, emailNotifications: checked }))
                      }
                      className="w-11 h-6 bg-gray-200 rounded-full relative data-[state=checked]:bg-primary outline-none cursor-pointer"
                    >
                      <Switch.Thumb className="block w-5 h-5 bg-white rounded-full shadow-md transform transition-transform data-[state=checked]:translate-x-5" />
                    </Switch.Root>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <label className="text-sm">Sound notifications</label>
                    <Switch.Root
                      checked={notificationSettings.soundEnabled}
                      onCheckedChange={(checked) => 
                        setNotificationSettings(prev => ({ ...prev, soundEnabled: checked }))
                      }
                      className="w-11 h-6 bg-gray-200 rounded-full relative data-[state=checked]:bg-primary outline-none cursor-pointer"
                    >
                      <Switch.Thumb className="block w-5 h-5 bg-white rounded-full shadow-md transform transition-transform data-[state=checked]:translate-x-5" />
                    </Switch.Root>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <Button variant="outline" onClick={() => setShowSettings(false)}>
                Cancel
              </Button>
              <Button onClick={() => setShowSettings(false)}>
                Save Settings
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}