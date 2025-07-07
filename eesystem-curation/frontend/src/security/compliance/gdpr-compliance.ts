import { auditLogger } from '../audit/audit-logger'
import { cryptoManager } from '../encryption/crypto-manager'

export interface DataSubject {
  id: string
  email: string
  name: string
  registrationDate: Date
  lastActivity: Date
  consents: ConsentRecord[]
  dataRetentionPolicy: string
}

export interface ConsentRecord {
  id: string
  subjectId: string
  purpose: string
  granted: boolean
  grantedAt: Date
  revokedAt?: Date
  lawfulBasis: 'consent' | 'contract' | 'legal_obligation' | 'vital_interests' | 'public_task' | 'legitimate_interests'
  consentType: 'explicit' | 'implicit' | 'opt_in' | 'opt_out'
}

export interface DataProcessingRecord {
  id: string
  subjectId: string
  dataCategory: string
  processingPurpose: string
  dataController: string
  dataProcessor?: string
  retentionPeriod: string
  crossBorderTransfer: boolean
  safeguards?: string[]
  createdAt: Date
  updatedAt: Date
}

export interface RightToAccessRequest {
  id: string
  subjectId: string
  requestType: 'access' | 'rectification' | 'erasure' | 'portability' | 'restriction' | 'objection'
  status: 'pending' | 'in_progress' | 'completed' | 'rejected'
  requestedAt: Date
  completedAt?: Date
  rejectionReason?: string
  deliveryMethod: 'email' | 'secure_download' | 'physical_mail'
}

export interface DataBreachIncident {
  id: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  affectedDataTypes: string[]
  affectedSubjects: number
  detectedAt: Date
  containedAt?: Date
  reportedToAuthority: boolean
  reportedAt?: Date
  notifiedSubjects: boolean
  notifiedAt?: Date
  mitigationSteps: string[]
  status: 'detected' | 'contained' | 'investigated' | 'resolved'
}

export class GDPRCompliance {
  private static instance: GDPRCompliance
  private dataSubjects: Map<string, DataSubject> = new Map()
  private consentRecords: Map<string, ConsentRecord> = new Map()
  private processingRecords: Map<string, DataProcessingRecord> = new Map()
  private accessRequests: Map<string, RightToAccessRequest> = new Map()
  private breachIncidents: Map<string, DataBreachIncident> = new Map()

  static getInstance(): GDPRCompliance {
    if (!GDPRCompliance.instance) {
      GDPRCompliance.instance = new GDPRCompliance()
    }
    return GDPRCompliance.instance
  }

  /**
   * Register a data subject
   */
  async registerDataSubject(
    email: string,
    name: string,
    initialConsents: Omit<ConsentRecord, 'id' | 'subjectId'>[]
  ): Promise<string> {
    const subjectId = this.generateSubjectId()
    
    const dataSubject: DataSubject = {
      id: subjectId,
      email,
      name,
      registrationDate: new Date(),
      lastActivity: new Date(),
      consents: [],
      dataRetentionPolicy: 'default'
    }

    // Create consent records
    const consentRecords: ConsentRecord[] = initialConsents.map(consent => ({
      id: this.generateConsentId(),
      subjectId,
      ...consent
    }))

    dataSubject.consents = consentRecords
    
    // Store records
    this.dataSubjects.set(subjectId, dataSubject)
    consentRecords.forEach(consent => {
      this.consentRecords.set(consent.id, consent)
    })

    await auditLogger.log({
      event: 'data_subject_registered',
      userId: 'system',
      resourceId: subjectId,
      resourceType: 'data_subject',
      details: {
        email,
        name,
        consents: initialConsents.map(c => c.purpose)
      }
    })

    return subjectId
  }

  /**
   * Record consent
   */
  async recordConsent(
    subjectId: string,
    purpose: string,
    granted: boolean,
    lawfulBasis: ConsentRecord['lawfulBasis'],
    consentType: ConsentRecord['consentType']
  ): Promise<string> {
    const consentId = this.generateConsentId()
    
    const consentRecord: ConsentRecord = {
      id: consentId,
      subjectId,
      purpose,
      granted,
      grantedAt: new Date(),
      lawfulBasis,
      consentType
    }

    if (!granted) {
      consentRecord.revokedAt = new Date()
    }

    this.consentRecords.set(consentId, consentRecord)

    // Update data subject
    const dataSubject = this.dataSubjects.get(subjectId)
    if (dataSubject) {
      dataSubject.consents.push(consentRecord)
      dataSubject.lastActivity = new Date()
      this.dataSubjects.set(subjectId, dataSubject)
    }

    await auditLogger.log({
      event: 'consent_recorded',
      userId: 'system',
      resourceId: subjectId,
      resourceType: 'consent',
      details: {
        consentId,
        purpose,
        granted,
        lawfulBasis,
        consentType
      }
    })

    return consentId
  }

  /**
   * Revoke consent
   */
  async revokeConsent(consentId: string): Promise<void> {
    const consentRecord = this.consentRecords.get(consentId)
    if (!consentRecord) {
      throw new Error('Consent record not found')
    }

    consentRecord.granted = false
    consentRecord.revokedAt = new Date()
    
    this.consentRecords.set(consentId, consentRecord)

    // Update data subject
    const dataSubject = this.dataSubjects.get(consentRecord.subjectId)
    if (dataSubject) {
      const consentIndex = dataSubject.consents.findIndex(c => c.id === consentId)
      if (consentIndex >= 0) {
        dataSubject.consents[consentIndex] = consentRecord
        dataSubject.lastActivity = new Date()
        this.dataSubjects.set(consentRecord.subjectId, dataSubject)
      }
    }

    await auditLogger.log({
      event: 'consent_revoked',
      userId: 'system',
      resourceId: consentRecord.subjectId,
      resourceType: 'consent',
      details: {
        consentId,
        purpose: consentRecord.purpose,
        revokedAt: consentRecord.revokedAt
      }
    })
  }

  /**
   * Create data processing record
   */
  async createProcessingRecord(
    subjectId: string,
    dataCategory: string,
    processingPurpose: string,
    dataController: string,
    retentionPeriod: string,
    crossBorderTransfer = false,
    safeguards?: string[]
  ): Promise<string> {
    const recordId = this.generateProcessingId()
    
    const processingRecord: DataProcessingRecord = {
      id: recordId,
      subjectId,
      dataCategory,
      processingPurpose,
      dataController,
      retentionPeriod,
      crossBorderTransfer,
      safeguards,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    this.processingRecords.set(recordId, processingRecord)

    await auditLogger.log({
      event: 'data_processing_recorded',
      userId: 'system',
      resourceId: subjectId,
      resourceType: 'processing_record',
      details: {
        recordId,
        dataCategory,
        processingPurpose,
        dataController,
        crossBorderTransfer
      }
    })

    return recordId
  }

  /**
   * Handle right of access request
   */
  async handleAccessRequest(
    subjectId: string,
    requestType: RightToAccessRequest['requestType'],
    deliveryMethod: RightToAccessRequest['deliveryMethod']
  ): Promise<string> {
    const requestId = this.generateRequestId()
    
    const accessRequest: RightToAccessRequest = {
      id: requestId,
      subjectId,
      requestType,
      status: 'pending',
      requestedAt: new Date(),
      deliveryMethod
    }

    this.accessRequests.set(requestId, accessRequest)

    await auditLogger.log({
      event: 'gdpr_request_received',
      userId: 'system',
      resourceId: subjectId,
      resourceType: 'access_request',
      details: {
        requestId,
        requestType,
        deliveryMethod
      }
    })

    // Auto-process access requests
    if (requestType === 'access') {
      await this.processAccessRequest(requestId)
    }

    return requestId
  }

  /**
   * Process access request
   */
  private async processAccessRequest(requestId: string): Promise<void> {
    const accessRequest = this.accessRequests.get(requestId)
    if (!accessRequest) {
      throw new Error('Access request not found')
    }

    accessRequest.status = 'in_progress'
    this.accessRequests.set(requestId, accessRequest)

    try {
      const dataSubject = this.dataSubjects.get(accessRequest.subjectId)
      if (!dataSubject) {
        throw new Error('Data subject not found')
      }

      // Collect all data for the subject
      const subjectData = await this.collectSubjectData(accessRequest.subjectId)
      
      // Encrypt the data for secure delivery
      const encryptedData = await cryptoManager.encryptData(JSON.stringify(subjectData))
      
      // Mark as completed
      accessRequest.status = 'completed'
      accessRequest.completedAt = new Date()
      this.accessRequests.set(requestId, accessRequest)

      await auditLogger.log({
        event: 'gdpr_request_completed',
        userId: 'system',
        resourceId: accessRequest.subjectId,
        resourceType: 'access_request',
        details: {
          requestId,
          requestType: accessRequest.requestType,
          dataSize: JSON.stringify(subjectData).length
        }
      })

    } catch (error) {
      accessRequest.status = 'rejected'
      accessRequest.rejectionReason = error instanceof Error ? error.message : 'Unknown error'
      this.accessRequests.set(requestId, accessRequest)

      await auditLogger.log({
        event: 'gdpr_request_failed',
        userId: 'system',
        resourceId: accessRequest.subjectId,
        resourceType: 'access_request',
        details: {
          requestId,
          error: accessRequest.rejectionReason
        }
      })
    }
  }

  /**
   * Collect all data for a subject
   */
  private async collectSubjectData(subjectId: string): Promise<any> {
    const dataSubject = this.dataSubjects.get(subjectId)
    const processingRecords = Array.from(this.processingRecords.values())
      .filter(record => record.subjectId === subjectId)
    
    const auditTrail = await auditLogger.queryLogs({
      userId: subjectId,
      limit: 1000
    })

    return {
      personalData: {
        id: dataSubject?.id,
        email: dataSubject?.email,
        name: dataSubject?.name,
        registrationDate: dataSubject?.registrationDate,
        lastActivity: dataSubject?.lastActivity
      },
      consents: dataSubject?.consents || [],
      processingRecords,
      auditTrail: auditTrail.map(log => ({
        timestamp: log.timestamp,
        event: log.event,
        action: log.action,
        details: log.details
      }))
    }
  }

  /**
   * Handle data erasure request (Right to be forgotten)
   */
  async handleErasureRequest(subjectId: string): Promise<void> {
    const dataSubject = this.dataSubjects.get(subjectId)
    if (!dataSubject) {
      throw new Error('Data subject not found')
    }

    // Remove all data for the subject
    this.dataSubjects.delete(subjectId)
    
    // Remove consent records
    const subjectConsents = Array.from(this.consentRecords.values())
      .filter(consent => consent.subjectId === subjectId)
    
    subjectConsents.forEach(consent => {
      this.consentRecords.delete(consent.id)
    })

    // Remove processing records
    const subjectProcessingRecords = Array.from(this.processingRecords.values())
      .filter(record => record.subjectId === subjectId)
    
    subjectProcessingRecords.forEach(record => {
      this.processingRecords.delete(record.id)
    })

    await auditLogger.log({
      event: 'data_subject_erased',
      userId: 'system',
      resourceId: subjectId,
      resourceType: 'data_subject',
      details: {
        consentRecordsRemoved: subjectConsents.length,
        processingRecordsRemoved: subjectProcessingRecords.length
      }
    })
  }

  /**
   * Report data breach
   */
  async reportDataBreach(
    description: string,
    severity: DataBreachIncident['severity'],
    affectedDataTypes: string[],
    affectedSubjects: number
  ): Promise<string> {
    const incidentId = this.generateIncidentId()
    
    const breach: DataBreachIncident = {
      id: incidentId,
      description,
      severity,
      affectedDataTypes,
      affectedSubjects,
      detectedAt: new Date(),
      reportedToAuthority: false,
      notifiedSubjects: false,
      mitigationSteps: [],
      status: 'detected'
    }

    this.breachIncidents.set(incidentId, breach)

    await auditLogger.log({
      event: 'data_breach_reported',
      userId: 'system',
      resourceId: incidentId,
      resourceType: 'data_breach',
      details: {
        description,
        severity,
        affectedDataTypes,
        affectedSubjects
      }
    })

    // Auto-notify if high severity
    if (severity === 'high' || severity === 'critical') {
      await this.notifyDataProtectionAuthority(incidentId)
    }

    return incidentId
  }

  /**
   * Notify data protection authority
   */
  private async notifyDataProtectionAuthority(incidentId: string): Promise<void> {
    const breach = this.breachIncidents.get(incidentId)
    if (!breach) {
      throw new Error('Breach incident not found')
    }

    breach.reportedToAuthority = true
    breach.reportedAt = new Date()
    this.breachIncidents.set(incidentId, breach)

    await auditLogger.log({
      event: 'data_breach_authority_notified',
      userId: 'system',
      resourceId: incidentId,
      resourceType: 'data_breach',
      details: {
        severity: breach.severity,
        reportedAt: breach.reportedAt
      }
    })
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(): Promise<any> {
    const totalSubjects = this.dataSubjects.size
    const activeConsents = Array.from(this.consentRecords.values())
      .filter(consent => consent.granted).length
    
    const pendingRequests = Array.from(this.accessRequests.values())
      .filter(request => request.status === 'pending').length
    
    const dataBreaches = Array.from(this.breachIncidents.values())
      .filter(breach => breach.detectedAt > new Date(Date.now() - 365 * 24 * 60 * 60 * 1000))
    
    return {
      totalDataSubjects: totalSubjects,
      activeConsents,
      pendingRequests,
      dataBreaches: dataBreaches.length,
      criticalBreaches: dataBreaches.filter(b => b.severity === 'critical').length,
      complianceScore: this.calculateComplianceScore(),
      recommendations: this.generateComplianceRecommendations()
    }
  }

  /**
   * Calculate compliance score
   */
  private calculateComplianceScore(): number {
    let score = 100
    
    // Deduct points for pending requests
    const pendingRequests = Array.from(this.accessRequests.values())
      .filter(request => request.status === 'pending').length
    
    score -= pendingRequests * 5

    // Deduct points for data breaches
    const recentBreaches = Array.from(this.breachIncidents.values())
      .filter(breach => breach.detectedAt > new Date(Date.now() - 365 * 24 * 60 * 60 * 1000))
    
    score -= recentBreaches.length * 10

    return Math.max(0, score)
  }

  /**
   * Generate compliance recommendations
   */
  private generateComplianceRecommendations(): string[] {
    const recommendations: string[] = []
    
    const pendingRequests = Array.from(this.accessRequests.values())
      .filter(request => request.status === 'pending').length
    
    if (pendingRequests > 0) {
      recommendations.push(`Process ${pendingRequests} pending GDPR requests`)
    }

    const expiredConsents = Array.from(this.consentRecords.values())
      .filter(consent => {
        const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
        return consent.grantedAt < oneYearAgo && consent.granted
      }).length
    
    if (expiredConsents > 0) {
      recommendations.push(`Review ${expiredConsents} consents older than 1 year`)
    }

    return recommendations
  }

  /**
   * Generate unique IDs
   */
  private generateSubjectId(): string {
    return `subj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateConsentId(): string {
    return `cons_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateProcessingId(): string {
    return `proc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateIncidentId(): string {
    return `inc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

export const gdprCompliance = GDPRCompliance.getInstance()