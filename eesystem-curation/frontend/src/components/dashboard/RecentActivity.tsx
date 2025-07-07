import React from 'react'
import { NotificationMessage } from '../../types'
import { formatDateTime } from '../../lib/utils'
import { Badge } from '../ui/Badge'
import { Bell, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'

interface RecentActivityProps {
  notifications: NotificationMessage[]
}

export const RecentActivity: React.FC<RecentActivityProps> = ({ notifications }) => {
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />
      default:
        return <Bell className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getNotificationBadgeVariant = (type: string) => {
    switch (type) {
      case 'success':
        return 'success'
      case 'error':
        return 'destructive'
      case 'warning':
        return 'warning'
      case 'info':
        return 'info'
      default:
        return 'secondary'
    }
  }

  if (notifications.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No recent activity</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {notifications.map((notification) => (
        <div key={notification.id} className="flex items-start space-x-3 p-3 bg-muted/50 rounded-lg">
          <div className="flex-shrink-0 mt-0.5">
            {getNotificationIcon(notification.type)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium truncate">{notification.title}</p>
              <Badge variant={getNotificationBadgeVariant(notification.type)} className="text-xs">
                {notification.type}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{notification.message}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatDateTime(notification.timestamp)}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}