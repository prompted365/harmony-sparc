import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Progress } from '../ui/Progress'
import { Button } from '../ui/Button'
import { 
  FileText, 
  Bot, 
  Calendar, 
  TrendingUp,
  Activity,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import { Content, AIAgent, Analytics } from '../../types'
import { useWebSocket } from '../../contexts/WebSocketContext'
import apiService from '../../services/api'
import { formatDateTime } from '../../lib/utils'
import { ContentChart } from './ContentChart'
import { RecentActivity } from './RecentActivity'

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({
    totalContent: 0,
    activeAgents: 0,
    scheduledContent: 0,
    totalViews: 0,
  })
  const [recentContent, setRecentContent] = useState<Content[]>([])
  const [agents, setAgents] = useState<AIAgent[]>([])
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  const { isConnected, notifications } = useWebSocket()

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      const [contentData, agentsData, analyticsData] = await Promise.all([
        apiService.getContent({ limit: 5 }),
        apiService.getAgents(),
        apiService.getAnalytics({ timeRange: '7d' })
      ])

      setRecentContent(contentData.items)
      setAgents(agentsData)
      setAnalytics(analyticsData)
      
      setStats({
        totalContent: contentData.total,
        activeAgents: agentsData.filter(a => a.status === 'working').length,
        scheduledContent: contentData.items.filter(c => c.status === 'scheduled').length,
        totalViews: analyticsData.brandAnalytics.totalReach,
      })
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'working': return 'success'
      case 'idle': return 'secondary'
      case 'error': return 'destructive'
      case 'paused': return 'warning'
      default: return 'secondary'
    }
  }

  const getContentStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'success'
      case 'scheduled': return 'info'
      case 'draft': return 'secondary'
      case 'review': return 'warning'
      case 'generating': return 'info'
      default: return 'secondary'
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-20 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's what's happening with your content.</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-muted-foreground">
            {isConnected ? 'Real-time updates active' : 'Offline mode'}
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Content</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalContent}</div>
            <p className="text-xs text-muted-foreground">+12% from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeAgents}</div>
            <p className="text-xs text-muted-foreground">out of {agents.length} total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.scheduledContent}</div>
            <p className="text-xs text-muted-foreground">next 7 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Views</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalViews.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">+5.2% from last week</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Recent Content */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Recent Content
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentContent.map((content) => (
                <div key={content.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium">{content.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      {content.type} • {formatDateTime(content.createdAt)}
                    </p>
                  </div>
                  <Badge variant={getContentStatusColor(content.status)}>
                    {content.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* AI Agents Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Bot className="h-5 w-5 mr-2" />
              AI Agents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {agents.slice(0, 5).map((agent) => (
                <div key={agent.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${
                      agent.status === 'working' ? 'bg-green-500' : 
                      agent.status === 'idle' ? 'bg-gray-500' : 
                      agent.status === 'error' ? 'bg-red-500' : 'bg-yellow-500'
                    }`} />
                    <span className="text-sm font-medium">{agent.name}</span>
                  </div>
                  <Badge variant={getStatusColor(agent.status)} className="text-xs">
                    {agent.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Analytics */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="h-5 w-5 mr-2" />
              Content Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics && <ContentChart data={analytics.brandAnalytics.publishingSchedule} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="h-5 w-5 mr-2" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RecentActivity notifications={notifications.slice(0, 5)} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}