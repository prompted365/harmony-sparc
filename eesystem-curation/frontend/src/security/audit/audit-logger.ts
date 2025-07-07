import { cryptoManager } from '../encryption/crypto-manager'

export interface AuditEvent {
  id: string
  timestamp: Date
  event: string
  userId: string
  userRole?: string
  resourceId?: string
  resourceType?: string
  action: string
  result: 'success' | 'failure' | 'warning'
  details: Record<string, any>
  ip?: string
  userAgent?: string
  sessionId?: string
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
}

export interface AuditFilter {
  startDate?: Date
  endDate?: Date
  userId?: string
  event?: string
  result?: 'success' | 'failure' | 'warning'
  riskLevel?: 'low' | 'medium' | 'high' | 'critical'
  resourceType?: string
  limit?: number
  offset?: number
}

export interface ComplianceReport {
  period: string
  totalEvents: number
  eventsByType: Record<string, number>
  securityIncidents: number
  dataAccess: number
  systemChanges: number
  failedAttempts: number
  complianceScore: number
  recommendations: string[]
}

export class AuditLogger {
  private static instance: AuditLogger
  private auditLog: AuditEvent[] = []
  private maxLogSize = 10000
  private initialized = false

  static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger()
    }
    return AuditLogger.instance
  }

  async initialize(): Promise<void> {
    this.initialized = true
  }

  /**
   * Log an audit event
   */
  async log(eventData: {
    event: string
    userId: string
    userRole?: string
    resourceId?: string
    resourceType?: string
    details: Record<string, any>
    ip?: string
    userAgent?: string
    sessionId?: string
  }): Promise<void> {
    if (!this.initialized) {
      await this.initialize()
    }

    const auditEvent: AuditEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      action: eventData.event,
      result: this.determineResult(eventData),
      riskLevel: this.assessRiskLevel(eventData),
      ...eventData
    }

    this.auditLog.push(auditEvent)

    // Maintain log size
    if (this.auditLog.length > this.maxLogSize) {
      this.auditLog = this.auditLog.slice(-this.maxLogSize)
    }

    // Alert on high-risk events
    if (auditEvent.riskLevel === 'critical' || auditEvent.riskLevel === 'high') {
      await this.alertSecurityTeam(auditEvent)
    }

    // Store in persistent storage (would be database in production)
    await this.persistAuditEvent(auditEvent)
  }

  /**
   * Query audit logs
   */
  async queryLogs(filter: AuditFilter): Promise<AuditEvent[]> {
    let filteredLogs = [...this.auditLog]

    if (filter.startDate) {
      filteredLogs = filteredLogs.filter(log => log.timestamp >= filter.startDate!)
    }

    if (filter.endDate) {
      filteredLogs = filteredLogs.filter(log => log.timestamp <= filter.endDate!)
    }

    if (filter.userId) {
      filteredLogs = filteredLogs.filter(log => log.userId === filter.userId)
    }

    if (filter.event) {
      filteredLogs = filteredLogs.filter(log => log.event === filter.event)
    }

    if (filter.result) {
      filteredLogs = filteredLogs.filter(log => log.result === filter.result)
    }

    if (filter.riskLevel) {
      filteredLogs = filteredLogs.filter(log => log.riskLevel === filter.riskLevel)
    }

    if (filter.resourceType) {
      filteredLogs = filteredLogs.filter(log => log.resourceType === filter.resourceType)
    }

    // Sort by timestamp (newest first)
    filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    // Apply pagination
    const offset = filter.offset || 0
    const limit = filter.limit || 100
    return filteredLogs.slice(offset, offset + limit)
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(startDate: Date, endDate: Date): Promise<ComplianceReport> {
    const logs = await this.queryLogs({ startDate, endDate })
    
    const eventsByType = logs.reduce((acc, log) => {
      acc[log.event] = (acc[log.event] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const securityIncidents = logs.filter(log => 
      log.riskLevel === 'high' || log.riskLevel === 'critical'
    ).length

    const dataAccess = logs.filter(log => 
      log.event.includes('data_access') || log.event.includes('credential_')
    ).length

    const systemChanges = logs.filter(log => 
      log.event.includes('system_') || log.event.includes('config_')
    ).length

    const failedAttempts = logs.filter(log => 
      log.result === 'failure'
    ).length

    const complianceScore = this.calculateComplianceScore(logs)
    const recommendations = this.generateRecommendations(logs)

    return {
      period: `${startDate.toISOString()} to ${endDate.toISOString()}`,
      totalEvents: logs.length,
      eventsByType,
      securityIncidents,
      dataAccess,
      systemChanges,
      failedAttempts,
      complianceScore,
      recommendations
    }
  }

  /**
   * Export audit logs for compliance
   */
  async exportLogs(filter: AuditFilter, format: 'json' | 'csv' = 'json'): Promise<string> {
    const logs = await this.queryLogs(filter)
    
    if (format === 'csv') {
      return this.convertToCSV(logs)
    }

    return JSON.stringify(logs, null, 2)
  }

  /**
   * Security incident detection
   */
  async detectSecurityIncidents(): Promise<AuditEvent[]> {
    const recentLogs = await this.queryLogs({
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
    })

    const incidents: AuditEvent[] = []

    // Multiple failed login attempts
    const failedLogins = recentLogs.filter(log => 
      log.event === 'login_failed' && log.result === 'failure'
    )

    if (failedLogins.length > 5) {
      incidents.push(...failedLogins)
    }

    // Suspicious data access patterns
    const dataAccess = recentLogs.filter(log => 
      log.event.includes('data_access') || log.event.includes('credential_used')
    )

    // Check for bulk data access
    const bulkAccess = dataAccess.filter(log => 
      log.details.recordCount && log.details.recordCount > 100
    )

    if (bulkAccess.length > 0) {
      incidents.push(...bulkAccess)
    }

    // High-risk events
    const highRiskEvents = recentLogs.filter(log => 
      log.riskLevel === 'high' || log.riskLevel === 'critical'
    )

    incidents.push(...highRiskEvents)

    return incidents
  }

  /**
   * User activity timeline
   */
  async getUserActivityTimeline(userId: string, days: number = 30): Promise<AuditEvent[]> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    
    return await this.queryLogs({
      userId,
      startDate
    })
  }

  /**
   * Data access tracking
   */
  async trackDataAccess(
    userId: string,
    resourceType: string,
    resourceId: string,
    action: string,
    details: Record<string, any>
  ): Promise<void> {
    await this.log({
      event: 'data_access',
      userId,
      resourceType,
      resourceId,
      details: {
        action,
        ...details
      }
    })
  }

  /**
   * System change tracking
   */
  async trackSystemChange(
    userId: string,
    changeType: string,
    details: Record<string, any>
  ): Promise<void> {
    await this.log({
      event: 'system_change',
      userId,
      resourceType: 'system',
      details: {
        changeType,
        ...details
      }
    })
  }

  /**
   * Generate event ID
   */
  private generateEventId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Determine event result
   */
  private determineResult(eventData: any): 'success' | 'failure' | 'warning' {
    if (eventData.details.error || eventData.event.includes('failed')) {
      return 'failure'
    }
    
    if (eventData.event.includes('warning') || eventData.event.includes('suspicious')) {
      return 'warning'
    }

    return 'success'
  }

  /**
   * Assess risk level
   */
  private assessRiskLevel(eventData: any): 'low' | 'medium' | 'high' | 'critical' {
    const highRiskEvents = [
      'admin_access',
      'credential_created',
      'credential_deleted',
      'system_config_changed',
      'user_role_changed',
      'data_export',
      'bulk_data_access'
    ]

    const criticalRiskEvents = [
      'security_breach',
      'unauthorized_access',
      'data_leak',
      'system_compromise',
      'credential_compromise'
    ]

    if (criticalRiskEvents.includes(eventData.event)) {
      return 'critical'
    }

    if (highRiskEvents.includes(eventData.event)) {
      return 'high'
    }

    if (eventData.event.includes('failed') || eventData.event.includes('suspicious')) {
      return 'medium'
    }

    return 'low'
  }

  /**
   * Alert security team
   */
  private async alertSecurityTeam(event: AuditEvent): Promise<void> {
    // In production, this would send alerts via email, Slack, etc.
    console.warn('SECURITY ALERT:', {
      event: event.event,
      riskLevel: event.riskLevel,
      timestamp: event.timestamp,
      userId: event.userId,
      details: event.details
    })
  }

  /**
   * Persist audit event
   */
  private async persistAuditEvent(event: AuditEvent): Promise<void> {
    // In production, this would store to database
    // For now, we'll just log to console in dev mode
    if (process.env.NODE_ENV === 'development') {
      console.log('AUDIT:', event)
    }
  }

  /**
   * Calculate compliance score
   */
  private calculateComplianceScore(logs: AuditEvent[]): number {
    if (logs.length === 0) return 100

    const securityIncidents = logs.filter(log => 
      log.riskLevel === 'high' || log.riskLevel === 'critical'
    ).length

    const failedAttempts = logs.filter(log => 
      log.result === 'failure'
    ).length

    const incidentRatio = securityIncidents / logs.length
    const failureRatio = failedAttempts / logs.length

    return Math.max(0, 100 - (incidentRatio * 50) - (failureRatio * 30))
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(logs: AuditEvent[]): string[] {
    const recommendations: string[] = []

    const failedLogins = logs.filter(log => 
      log.event === 'login_failed'
    ).length

    if (failedLogins > 10) {
      recommendations.push('Consider implementing account lockout after multiple failed login attempts')
    }

    const highRiskEvents = logs.filter(log => 
      log.riskLevel === 'high' || log.riskLevel === 'critical'
    ).length

    if (highRiskEvents > 5) {
      recommendations.push('Review security procedures and implement additional monitoring')
    }

    const dataAccess = logs.filter(log => 
      log.event.includes('data_access')
    ).length

    if (dataAccess > 100) {
      recommendations.push('Implement data classification and access controls')
    }

    return recommendations
  }

  /**
   * Convert logs to CSV format
   */
  private convertToCSV(logs: AuditEvent[]): string {
    const headers = ['ID', 'Timestamp', 'Event', 'User ID', 'Resource ID', 'Action', 'Result', 'Risk Level']
    const rows = logs.map(log => [
      log.id,
      log.timestamp.toISOString(),
      log.event,
      log.userId,
      log.resourceId || '',
      log.action,
      log.result,
      log.riskLevel
    ])

    return [headers, ...rows].map(row => row.join(',')).join('\n')
  }
}

export const auditLogger = AuditLogger.getInstance()