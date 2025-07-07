import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  Home, 
  FileText, 
  Upload, 
  Calendar, 
  Bot, 
  BarChart3, 
  Settings, 
  Palette,
  Eye,
  PlusCircle
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from '../ui/Button'

const navigationItems = [
  { icon: Home, label: 'Dashboard', path: '/' },
  { icon: FileText, label: 'Content', path: '/content' },
  { icon: Upload, label: 'Upload', path: '/upload' },
  { icon: PlusCircle, label: 'Generate', path: '/generate' },
  { icon: Calendar, label: 'Calendar', path: '/calendar' },
  { icon: Eye, label: 'Preview', path: '/preview' },
  { icon: Bot, label: 'AI Agents', path: '/agents' },
  { icon: BarChart3, label: 'Analytics', path: '/analytics' },
  { icon: Palette, label: 'Brand', path: '/brand' },
  { icon: Settings, label: 'Settings', path: '/settings' },
]

export const Sidebar: React.FC = () => {
  const location = useLocation()

  return (
    <aside className="w-64 bg-card border-r border-border">
      <div className="p-4">
        <nav className="space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            
            return (
              <Link key={item.path} to={item.path}>
                <Button
                  variant={isActive ? 'secondary' : 'ghost'}
                  className={cn(
                    'w-full justify-start',
                    isActive && 'bg-primary/10 text-primary hover:bg-primary/20'
                  )}
                >
                  <Icon className="h-4 w-4 mr-3" />
                  {item.label}
                </Button>
              </Link>
            )
          })}
        </nav>
      </div>
      
      <div className="absolute bottom-4 left-4 right-4">
        <div className="bg-primary/10 rounded-lg p-4">
          <h3 className="font-semibold text-sm mb-2">Need Help?</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Check our documentation or contact support
          </p>
          <Button size="sm" variant="outline" className="w-full">
            Get Help
          </Button>
        </div>
      </div>
    </aside>
  )
}