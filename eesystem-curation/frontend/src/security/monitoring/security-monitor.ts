import { auditLogger } from '../audit/audit-logger'
import { securityMiddleware } from '../middleware/security-middleware'

export interface SecurityMetrics {
  timestamp: Date
  requestCount: number
  failedRequests: number
  blockedRequests: number
  suspiciousActivity: number
  rateLimitHits: number
  xssAttempts: number
  sqlInjectionAttempts: number
  authenticationFailures: number
  systemLoad: number
  errorRate: number
}

export interface SecurityAlert {
  id: string
  type: 'rate_limit' | 'suspicious_activity' | 'security_violation' | 'system_anomaly'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  details: Record<string, any>
  timestamp: Date
  resolved: boolean
  resolvedAt?: Date
  source: string
  affectedResources: string[]
}

export interface SecurityThreshold {
  metric: string
  threshold: number
  timeWindow: number // in milliseconds
  alertLevel: 'low' | 'medium' | 'high' | 'critical'
  enabled: boolean
}

export interface MonitoringRule {
  id: string
  name: string
  description: string
  conditions: {
    metric: string
    operator: '>' | '<' | '=' | '>=' | '<='
    value: number
    timeWindow: number
  }[]
  actions: {
    type: 'alert' | 'block' | 'throttle' | 'log'
    parameters: Record<string, any>
  }[]
  enabled: boolean
}

export class SecurityMonitor {
  private static instance: SecurityMonitor
  private metrics: SecurityMetrics[] = []
  private alerts: Map<string, SecurityAlert> = new Map()
  private thresholds: Map<string, SecurityThreshold> = new Map()
  private rules: Map<string, MonitoringRule> = new Map()
  private monitoringInterval: NodeJS.Timeout | null = null
  private maxMetricsHistory = 1000

  static getInstance(): SecurityMonitor {
    if (!SecurityMonitor.instance) {
      SecurityMonitor.instance = new SecurityMonitor()
    }
    return SecurityMonitor.instance
  }

  /**
   * Initialize monitoring system
   */
  async initialize(): Promise<void> {
    this.setupDefaultThresholds()
    this.setupDefaultRules()
    this.startMonitoring()
  }

  /**
   * Start continuous monitoring
   */
  private startMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
    }

    this.monitoringInterval = setInterval(async () => {
      await this.collectMetrics()
      await this.evaluateThresholds()
      await this.evaluateRules()
    }, 60000) // Collect metrics every minute
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }
  }

  /**
   * Collect security metrics
   */
  private async collectMetrics(): Promise<void> {
    const now = new Date()
    const oneMinuteAgo = new Date(now.getTime() - 60000)

    // Get recent audit logs
    const recentLogs = await auditLogger.queryLogs({
      startDate: oneMinuteAgo,
      endDate: now,
      limit: 1000
    })

    // Get security middleware stats
    const securityStats = securityMiddleware.getSecurityStats()

    // Calculate metrics
    const metrics: SecurityMetrics = {
      timestamp: now,
      requestCount: recentLogs.length,
      failedRequests: recentLogs.filter(log => log.result === 'failure').length,
      blockedRequests: securityStats.blockedIPs,
      suspiciousActivity: securityStats.suspiciousIPs,
      rateLimitHits: securityStats.rateLimitEntries,
      xssAttempts: recentLogs.filter(log => 
        log.details.xssDetected || log.event === 'xss_attempt'
      ).length,
      sqlInjectionAttempts: recentLogs.filter(log => 
        log.details.sqlInjectionDetected || log.event === 'sql_injection_attempt'
      ).length,
      authenticationFailures: recentLogs.filter(log => 
        log.event === 'login_failed' || log.event === 'authentication_failed'
      ).length,
      systemLoad: this.calculateSystemLoad(),
      errorRate: recentLogs.length > 0 ? 
        (recentLogs.filter(log => log.result === 'failure').length / recentLogs.length) * 100 : 0
    }

    this.metrics.push(metrics)

    // Maintain metrics history
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory)
    }
  }

  /**
   * Evaluate security thresholds
   */
  private async evaluateThresholds(): Promise<void> {
    const currentMetrics = this.metrics[this.metrics.length - 1]
    if (!currentMetrics) return

    for (const [metricName, threshold] of this.thresholds) {
      if (!threshold.enabled) continue

      const metricValue = (currentMetrics as any)[metricName]
      if (metricValue === undefined) continue

      if (metricValue > threshold.threshold) {
        await this.createAlert({
          type: 'system_anomaly',
          severity: threshold.alertLevel,
          message: `${metricName} threshold exceeded: ${metricValue} > ${threshold.threshold}`,
          details: {
            metric: metricName,
            value: metricValue,
            threshold: threshold.threshold,
            timeWindow: threshold.timeWindow
          },
          source: 'threshold_monitor',
          affectedResources: ['system']
        })
      }
    }
  }

  /**
   * Evaluate monitoring rules
   */
  private async evaluateRules(): Promise<void> {
    const currentMetrics = this.metrics[this.metrics.length - 1]
    if (!currentMetrics) return

    for (const [ruleId, rule] of this.rules) {
      if (!rule.enabled) continue

      const conditionsMet = rule.conditions.every(condition => {
        const metricValue = (currentMetrics as any)[condition.metric]
        if (metricValue === undefined) return false

        switch (condition.operator) {
          case '>': return metricValue > condition.value
          case '<': return metricValue < condition.value
          case '=': return metricValue === condition.value
          case '>=': return metricValue >= condition.value
          case '<=': return metricValue <= condition.value
          default: return false
        }
      })

      if (conditionsMet) {
        await this.executeRuleActions(rule)
      }
    }
  }

  /**
   * Execute rule actions
   */
  private async executeRuleActions(rule: MonitoringRule): Promise<void> {
    for (const action of rule.actions) {
      switch (action.type) {
        case 'alert':
          await this.createAlert({
            type: 'security_violation',
            severity: action.parameters.severity || 'medium',
            message: `Rule triggered: ${rule.name}`,
            details: {
              ruleId: rule.id,
              ruleName: rule.name,
              conditions: rule.conditions,
              ...action.parameters
            },
            source: 'rule_engine',
            affectedResources: action.parameters.affectedResources || ['system']
          })
          break

        case 'block':
          if (action.parameters.ip) {
            securityMiddleware.blockIP(action.parameters.ip, `Rule: ${rule.name}`)
          }
          break

        case 'throttle':
          // Implement throttling logic
          break

        case 'log':
          await auditLogger.log({
            event: 'monitoring_rule_triggered',
            userId: 'system',
            resourceId: rule.id,
            resourceType: 'monitoring_rule',
            details: {
              ruleName: rule.name,
              action: action.type,
              parameters: action.parameters
            }
          })
          break
      }
    }
  }

  /**
   * Create security alert
   */
  private async createAlert(alertData: Omit<SecurityAlert, 'id' | 'timestamp' | 'resolved'>): Promise<string> {
    const alertId = this.generateAlertId()
    
    const alert: SecurityAlert = {
      id: alertId,
      timestamp: new Date(),
      resolved: false,
      ...alertData
    }

    this.alerts.set(alertId, alert)

    await auditLogger.log({
      event: 'security_alert_created',
      userId: 'system',
      resourceId: alertId,
      resourceType: 'security_alert',
      details: {
        type: alert.type,
        severity: alert.severity,
        message: alert.message,
        source: alert.source
      }
    })

    // Send notifications for high/critical alerts
    if (alert.severity === 'high' || alert.severity === 'critical') {
      await this.sendAlertNotification(alert)
    }

    return alertId
  }

  /**
   * Resolve security alert
   */
  async resolveAlert(alertId: string, resolution: string): Promise<void> {
    const alert = this.alerts.get(alertId)
    if (!alert) {
      throw new Error('Alert not found')
    }

    alert.resolved = true
    alert.resolvedAt = new Date()
    this.alerts.set(alertId, alert)

    await auditLogger.log({
      event: 'security_alert_resolved',
      userId: 'system',
      resourceId: alertId,
      resourceType: 'security_alert',
      details: {
        resolution,
        resolvedAt: alert.resolvedAt
      }
    })
  }

  /**
   * Get security dashboard data
   */
  async getSecurityDashboard(): Promise<any> {
    const currentMetrics = this.metrics[this.metrics.length - 1]
    const activeAlerts = Array.from(this.alerts.values()).filter(alert => !alert.resolved)
    const recentMetrics = this.metrics.slice(-24) // Last 24 data points (hours)

    return {
      currentMetrics,
      activeAlerts: activeAlerts.length,
      criticalAlerts: activeAlerts.filter(alert => alert.severity === 'critical').length,
      highAlerts: activeAlerts.filter(alert => alert.severity === 'high').length,
      trends: this.calculateTrends(recentMetrics),
      topThreats: this.getTopThreats(),
      systemStatus: this.getSystemStatus()
    }
  }

  /**
   * Get security trends
   */
  private calculateTrends(metrics: SecurityMetrics[]): any {
    if (metrics.length < 2) return {}

    const latest = metrics[metrics.length - 1]
    const previous = metrics[metrics.length - 2]

    return {
      requestCount: this.calculateTrend(latest.requestCount, previous.requestCount),
      failedRequests: this.calculateTrend(latest.failedRequests, previous.failedRequests),
      authenticationFailures: this.calculateTrend(latest.authenticationFailures, previous.authenticationFailures),
      errorRate: this.calculateTrend(latest.errorRate, previous.errorRate)
    }
  }

  /**
   * Calculate trend percentage
   */
  private calculateTrend(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous) * 100
  }

  /**
   * Get top security threats
   */
  private getTopThreats(): any[] {
    const recentAlerts = Array.from(this.alerts.values())
      .filter(alert => alert.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    const threatCounts = recentAlerts.reduce((acc, alert) => {
      acc[alert.type] = (acc[alert.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return Object.entries(threatCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }

  /**
   * Get system status
   */
  private getSystemStatus(): string {
    const currentMetrics = this.metrics[this.metrics.length - 1]
    if (!currentMetrics) return 'unknown'

    const criticalAlerts = Array.from(this.alerts.values())
      .filter(alert => !alert.resolved && alert.severity === 'critical')

    if (criticalAlerts.length > 0) return 'critical'
    if (currentMetrics.errorRate > 10) return 'warning'
    if (currentMetrics.systemLoad > 80) return 'warning'
    
    return 'healthy'
  }

  /**
   * Setup default thresholds
   */
  private setupDefaultThresholds(): void {
    const defaultThresholds: SecurityThreshold[] = [
      { metric: 'failedRequests', threshold: 50, timeWindow: 60000, alertLevel: 'medium', enabled: true },
      { metric: 'authenticationFailures', threshold: 10, timeWindow: 60000, alertLevel: 'high', enabled: true },
      { metric: 'xssAttempts', threshold: 5, timeWindow: 60000, alertLevel: 'high', enabled: true },
      { metric: 'sqlInjectionAttempts', threshold: 3, timeWindow: 60000, alertLevel: 'critical', enabled: true },
      { metric: 'errorRate', threshold: 15, timeWindow: 60000, alertLevel: 'medium', enabled: true },
      { metric: 'systemLoad', threshold: 90, timeWindow: 60000, alertLevel: 'high', enabled: true }
    ]

    defaultThresholds.forEach(threshold => {
      this.thresholds.set(threshold.metric, threshold)
    })
  }

  /**
   * Setup default monitoring rules
   */
  private setupDefaultRules(): void {
    const defaultRules: MonitoringRule[] = [
      {
        id: 'multiple_auth_failures',
        name: 'Multiple Authentication Failures',
        description: 'Detect multiple authentication failures in short period',
        conditions: [
          { metric: 'authenticationFailures', operator: '>', value: 5, timeWindow: 300000 }
        ],
        actions: [
          { type: 'alert', parameters: { severity: 'high' } },
          { type: 'log', parameters: {} }
        ],
        enabled: true
      },
      {
        id: 'sql_injection_detected',
        name: 'SQL Injection Detected',
        description: 'Detect SQL injection attempts',
        conditions: [
          { metric: 'sqlInjectionAttempts', operator: '>', value: 0, timeWindow: 60000 }
        ],
        actions: [
          { type: 'alert', parameters: { severity: 'critical' } },
          { type: 'block', parameters: {} }
        ],
        enabled: true
      }
    ]

    defaultRules.forEach(rule => {
      this.rules.set(rule.id, rule)
    })
  }

  /**
   * Calculate system load (placeholder)
   */
  private calculateSystemLoad(): number {
    // This would typically measure CPU, memory, etc.
    // For now, return a mock value
    return Math.random() * 100
  }

  /**
   * Send alert notification
   */
  private async sendAlertNotification(alert: SecurityAlert): Promise<void> {
    // In production, this would send notifications via email, Slack, etc.
    console.warn('SECURITY ALERT NOTIFICATION:', {
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      timestamp: alert.timestamp
    })
  }

  /**
   * Generate alert ID
   */
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get monitoring statistics
   */
  getMonitoringStats(): any {
    const totalAlerts = this.alerts.size
    const activeAlerts = Array.from(this.alerts.values()).filter(alert => !alert.resolved).length
    const metricsCollected = this.metrics.length
    const activeThresholds = Array.from(this.thresholds.values()).filter(t => t.enabled).length
    const activeRules = Array.from(this.rules.values()).filter(r => r.enabled).length

    return {
      totalAlerts,
      activeAlerts,
      metricsCollected,
      activeThresholds,
      activeRules,
      monitoringActive: this.monitoringInterval !== null
    }
  }
}

export const securityMonitor = SecurityMonitor.getInstance()