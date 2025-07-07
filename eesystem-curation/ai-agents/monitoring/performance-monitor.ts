/**
 * Performance Monitor - EESystem Content Curation Platform
 * Monitors and optimizes AI agent performance and coordination
 */

import { AgentType, AgentMetrics } from '../types/agent-types';

export class PerformanceMonitor {
  private metrics: Map<string, AgentMetrics>;
  private workflowMetrics: Map<string, WorkflowMetrics>;
  private performanceHistory: PerformanceEntry[];
  private alertThresholds: AlertThresholds;
  private isMonitoring: boolean;

  constructor() {
    this.metrics = new Map();
    this.workflowMetrics = new Map();
    this.performanceHistory = [];
    this.isMonitoring = false;
    
    this.alertThresholds = {
      maxExecutionTime: 60000, // 60 seconds
      minSuccessRate: 80, // 80%
      maxErrorRate: 20, // 20%
      maxMemoryUsage: 100 * 1024 * 1024, // 100MB
      maxResponseTime: 30000 // 30 seconds
    };
  }

  startMonitoring(): void {
    if (this.isMonitoring) {
      console.log('Performance monitoring already active');
      return;
    }

    this.isMonitoring = true;
    console.log('Performance monitoring started');
    
    // Start monitoring intervals
    this.startPerformanceCollection();
    this.startAlertMonitoring();
  }

  stopMonitoring(): void {
    this.isMonitoring = false;
    console.log('Performance monitoring stopped');
  }

  // Agent performance tracking
  recordAgentExecution(agentId: string, executionTime: number, success: boolean, error?: string): void {
    const existing = this.metrics.get(agentId) || this.createEmptyMetrics(agentId);
    
    // Update metrics
    existing.tasksCompleted++;
    existing.averageExecutionTime = this.updateAverage(
      existing.averageExecutionTime,
      executionTime,
      existing.tasksCompleted
    );
    
    if (success) {
      existing.successRate = ((existing.successRate * (existing.tasksCompleted - 1)) + 100) / existing.tasksCompleted;
    } else {
      existing.errorCount++;
      existing.successRate = ((existing.successRate * (existing.tasksCompleted - 1)) + 0) / existing.tasksCompleted;
    }
    
    existing.lastActivity = new Date().toISOString();
    
    this.metrics.set(agentId, existing);
    
    // Record in history
    this.addPerformanceEntry({
      type: 'agent_execution',
      agentId,
      timestamp: new Date().toISOString(),
      executionTime,
      success,
      error,
      metrics: { ...existing }
    });
    
    // Check for alerts
    this.checkAgentAlerts(agentId, existing);
  }

  recordWorkflowExecution(workflowId: string, duration: number, success: boolean, stepsCompleted: number, stepsTotal: number): void {
    const metrics: WorkflowMetrics = {
      workflowId,
      executionCount: (this.workflowMetrics.get(workflowId)?.executionCount || 0) + 1,
      averageDuration: this.updateAverage(
        this.workflowMetrics.get(workflowId)?.averageDuration || 0,
        duration,
        (this.workflowMetrics.get(workflowId)?.executionCount || 0) + 1
      ),
      successRate: this.updateSuccessRate(workflowId, success),
      stepsCompleted,
      stepsTotal,
      lastExecution: new Date().toISOString()
    };
    
    this.workflowMetrics.set(workflowId, metrics);
    
    // Record in history
    this.addPerformanceEntry({
      type: 'workflow_execution',
      workflowId,
      timestamp: new Date().toISOString(),
      executionTime: duration,
      success,
      metrics: { ...metrics }
    });
  }

  // Performance analysis
  getAgentPerformance(agentId: string): AgentPerformanceReport | null {
    const metrics = this.metrics.get(agentId);
    if (!metrics) return null;
    
    const recentHistory = this.getRecentAgentHistory(agentId, 24 * 60 * 60 * 1000); // Last 24 hours
    const trends = this.calculateTrends(recentHistory);
    
    return {
      agentId,
      currentMetrics: metrics,
      trends,
      recommendations: this.generateAgentRecommendations(metrics, trends),
      alerts: this.getActiveAlerts(agentId),
      performanceGrade: this.calculatePerformanceGrade(metrics)
    };
  }

  getWorkflowPerformance(workflowId: string): WorkflowPerformanceReport | null {
    const metrics = this.workflowMetrics.get(workflowId);
    if (!metrics) return null;
    
    const recentHistory = this.getRecentWorkflowHistory(workflowId, 24 * 60 * 60 * 1000);
    const bottlenecks = this.identifyBottlenecks(workflowId);
    
    return {
      workflowId,
      currentMetrics: metrics,
      bottlenecks,
      recommendations: this.generateWorkflowRecommendations(metrics, bottlenecks),
      performanceGrade: this.calculateWorkflowGrade(metrics)
    };
  }

  getSystemPerformance(): SystemPerformanceReport {
    const allAgents = Array.from(this.metrics.values());
    const allWorkflows = Array.from(this.workflowMetrics.values());
    
    return {
      timestamp: new Date().toISOString(),
      overview: {
        totalAgents: allAgents.length,
        activeAgents: allAgents.filter(m => this.isRecentlyActive(m.lastActivity)).length,
        totalWorkflows: allWorkflows.length,
        systemLoad: this.calculateSystemLoad(),
        overallHealth: this.calculateSystemHealth()
      },
      topPerformers: this.getTopPerformingAgents(5),
      bottlenecks: this.getSystemBottlenecks(),
      trends: this.calculateSystemTrends(),
      recommendations: this.generateSystemRecommendations()
    };
  }

  // Optimization suggestions
  generateOptimizationPlan(): OptimizationPlan {
    const systemReport = this.getSystemPerformance();
    const optimizations: Optimization[] = [];
    
    // Agent-level optimizations
    for (const [agentId, metrics] of this.metrics) {
      if (metrics.averageExecutionTime > this.alertThresholds.maxExecutionTime) {
        optimizations.push({
          type: 'agent_performance',
          target: agentId,
          priority: 'high',
          description: `Optimize ${agentId} execution time (currently ${metrics.averageExecutionTime}ms)`,
          expectedImpact: 'Reduce execution time by 20-30%',
          actions: [
            'Profile agent operations for bottlenecks',
            'Optimize memory usage',
            'Consider parallel processing',
            'Review algorithm efficiency'
          ]
        });
      }
      
      if (metrics.successRate < this.alertThresholds.minSuccessRate) {
        optimizations.push({
          type: 'agent_reliability',
          target: agentId,
          priority: 'critical',
          description: `Improve ${agentId} success rate (currently ${metrics.successRate}%)`,
          expectedImpact: 'Increase reliability by 15-25%',
          actions: [
            'Analyze error patterns',
            'Improve error handling',
            'Add retry mechanisms',
            'Enhance input validation'
          ]
        });
      }
    }
    
    // Workflow-level optimizations
    for (const [workflowId, metrics] of this.workflowMetrics) {
      if (metrics.averageDuration > 120000) { // 2 minutes
        optimizations.push({
          type: 'workflow_performance',
          target: workflowId,
          priority: 'medium',
          description: `Optimize ${workflowId} execution time`,
          expectedImpact: 'Reduce workflow duration by 25-40%',
          actions: [
            'Parallelize independent steps',
            'Optimize agent coordination',
            'Reduce memory coordination overhead',
            'Cache frequently used data'
          ]
        });
      }
    }
    
    // System-level optimizations
    if (systemReport.overview.systemLoad > 80) {
      optimizations.push({
        type: 'system_performance',
        target: 'system',
        priority: 'high',
        description: 'Reduce overall system load',
        expectedImpact: 'Improve system responsiveness by 30-50%',
        actions: [
          'Implement load balancing',
          'Add resource pooling',
          'Optimize memory management',
          'Schedule tasks more efficiently'
        ]
      });
    }
    
    return {
      timestamp: new Date().toISOString(),
      systemHealth: systemReport.overview.overallHealth,
      totalOptimizations: optimizations.length,
      optimizations: optimizations.sort((a, b) => this.priorityWeight(a.priority) - this.priorityWeight(b.priority)),
      estimatedImpact: this.calculateEstimatedImpact(optimizations)
    };
  }

  // Real-time monitoring
  enableRealTimeMonitoring(callback: (alert: PerformanceAlert) => void): void {
    // Set up real-time monitoring with callback for alerts
    setInterval(() => {
      if (!this.isMonitoring) return;
      
      const alerts = this.checkAllAlerts();
      alerts.forEach(callback);
    }, 5000); // Check every 5 seconds
  }

  // Memory and cleanup
  cleanupOldData(maxAge: number = 7 * 24 * 60 * 60 * 1000): number {
    // Clean up performance history older than maxAge (default 7 days)
    const cutoffTime = Date.now() - maxAge;
    const oldLength = this.performanceHistory.length;
    
    this.performanceHistory = this.performanceHistory.filter(entry =>
      new Date(entry.timestamp).getTime() > cutoffTime
    );
    
    return oldLength - this.performanceHistory.length;
  }

  exportPerformanceData(): PerformanceExport {
    return {
      timestamp: new Date().toISOString(),
      agentMetrics: Object.fromEntries(this.metrics),
      workflowMetrics: Object.fromEntries(this.workflowMetrics),
      performanceHistory: this.performanceHistory.slice(-1000), // Last 1000 entries
      systemHealth: this.calculateSystemHealth(),
      alerts: this.getAllActiveAlerts()
    };
  }

  // Private methods
  private createEmptyMetrics(agentId: string): AgentMetrics {
    return {
      agentId,
      tasksCompleted: 0,
      averageExecutionTime: 0,
      successRate: 100,
      errorCount: 0,
      lastActivity: new Date().toISOString()
    };
  }

  private updateAverage(currentAvg: number, newValue: number, count: number): number {
    return ((currentAvg * (count - 1)) + newValue) / count;
  }

  private updateSuccessRate(workflowId: string, success: boolean): number {
    const existing = this.workflowMetrics.get(workflowId);
    if (!existing) return success ? 100 : 0;
    
    const totalRuns = existing.executionCount + 1;
    const successfulRuns = success ? 
      Math.round((existing.successRate / 100) * existing.executionCount) + 1 :
      Math.round((existing.successRate / 100) * existing.executionCount);
      
    return (successfulRuns / totalRuns) * 100;
  }

  private addPerformanceEntry(entry: PerformanceEntry): void {
    this.performanceHistory.push(entry);
    
    // Limit history size
    if (this.performanceHistory.length > 10000) {
      this.performanceHistory = this.performanceHistory.slice(-5000);
    }
  }

  private checkAgentAlerts(agentId: string, metrics: AgentMetrics): void {
    const alerts: PerformanceAlert[] = [];
    
    if (metrics.averageExecutionTime > this.alertThresholds.maxExecutionTime) {
      alerts.push({
        type: 'execution_time',
        severity: 'warning',
        agentId,
        message: `Agent ${agentId} execution time (${metrics.averageExecutionTime}ms) exceeds threshold`,
        timestamp: new Date().toISOString()
      });
    }
    
    if (metrics.successRate < this.alertThresholds.minSuccessRate) {
      alerts.push({
        type: 'success_rate',
        severity: 'critical',
        agentId,
        message: `Agent ${agentId} success rate (${metrics.successRate}%) below threshold`,
        timestamp: new Date().toISOString()
      });
    }
    
    // Store alerts for later retrieval
    alerts.forEach(alert => this.storeAlert(alert));
  }

  private checkAllAlerts(): PerformanceAlert[] {
    const alerts: PerformanceAlert[] = [];
    
    // Check all agents
    for (const [agentId, metrics] of this.metrics) {
      if (metrics.averageExecutionTime > this.alertThresholds.maxExecutionTime) {
        alerts.push({
          type: 'execution_time',
          severity: 'warning',
          agentId,
          message: `High execution time: ${metrics.averageExecutionTime}ms`,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    return alerts;
  }

  private storeAlert(alert: PerformanceAlert): void {
    // Store alert for tracking (in real implementation, might use external storage)
    this.addPerformanceEntry({
      type: 'alert',
      timestamp: alert.timestamp,
      agentId: alert.agentId,
      success: false,
      error: alert.message,
      alert
    });
  }

  private getRecentAgentHistory(agentId: string, timeWindow: number): PerformanceEntry[] {
    const cutoffTime = Date.now() - timeWindow;
    return this.performanceHistory.filter(entry =>
      entry.agentId === agentId &&
      new Date(entry.timestamp).getTime() > cutoffTime
    );
  }

  private getRecentWorkflowHistory(workflowId: string, timeWindow: number): PerformanceEntry[] {
    const cutoffTime = Date.now() - timeWindow;
    return this.performanceHistory.filter(entry =>
      entry.workflowId === workflowId &&
      new Date(entry.timestamp).getTime() > cutoffTime
    );
  }

  private calculateTrends(history: PerformanceEntry[]): PerformanceTrends {
    if (history.length < 2) {
      return { executionTime: 'stable', successRate: 'stable', errorRate: 'stable' };
    }
    
    const recent = history.slice(-10);
    const older = history.slice(-20, -10);
    
    return {
      executionTime: this.calculateTrend(
        recent.map(h => h.executionTime || 0),
        older.map(h => h.executionTime || 0)
      ),
      successRate: this.calculateTrend(
        recent.map(h => h.success ? 100 : 0),
        older.map(h => h.success ? 100 : 0)
      ),
      errorRate: this.calculateTrend(
        recent.map(h => h.success ? 0 : 100),
        older.map(h => h.success ? 0 : 100)
      )
    };
  }

  private calculateTrend(recent: number[], older: number[]): 'improving' | 'degrading' | 'stable' {
    if (recent.length === 0 || older.length === 0) return 'stable';
    
    const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const olderAvg = older.reduce((sum, val) => sum + val, 0) / older.length;
    
    const change = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    if (change > 10) return 'degrading';
    if (change < -10) return 'improving';
    return 'stable';
  }

  private generateAgentRecommendations(metrics: AgentMetrics, trends: PerformanceTrends): string[] {
    const recommendations = [];
    
    if (metrics.averageExecutionTime > 30000) {
      recommendations.push('Consider optimizing agent processing logic');
    }
    
    if (metrics.successRate < 90) {
      recommendations.push('Improve error handling and input validation');
    }
    
    if (trends.executionTime === 'degrading') {
      recommendations.push('Investigate recent performance degradation');
    }
    
    return recommendations;
  }

  private generateWorkflowRecommendations(metrics: WorkflowMetrics, bottlenecks: string[]): string[] {
    const recommendations = [];
    
    if (metrics.averageDuration > 60000) {
      recommendations.push('Consider parallelizing workflow steps');
    }
    
    if (bottlenecks.length > 0) {
      recommendations.push(`Address bottlenecks in: ${bottlenecks.join(', ')}`);
    }
    
    return recommendations;
  }

  private identifyBottlenecks(workflowId: string): string[] {
    // Identify workflow bottlenecks (simplified implementation)
    return ['script-generation', 'compliance-check']; // Mock bottlenecks
  }

  private isRecentlyActive(lastActivity: string): boolean {
    const activityTime = new Date(lastActivity).getTime();
    const now = Date.now();
    return (now - activityTime) < (60 * 60 * 1000); // Active within last hour
  }

  private calculateSystemLoad(): number {
    // Calculate system load based on active agents and recent activity
    const activeAgents = Array.from(this.metrics.values())
      .filter(m => this.isRecentlyActive(m.lastActivity)).length;
    const totalAgents = this.metrics.size;
    
    return totalAgents > 0 ? (activeAgents / totalAgents) * 100 : 0;
  }

  private calculateSystemHealth(): number {
    // Calculate overall system health score
    const agents = Array.from(this.metrics.values());
    if (agents.length === 0) return 100;
    
    const avgSuccessRate = agents.reduce((sum, m) => sum + m.successRate, 0) / agents.length;
    const avgExecutionTime = agents.reduce((sum, m) => sum + m.averageExecutionTime, 0) / agents.length;
    
    let health = avgSuccessRate;
    
    // Penalize slow execution times
    if (avgExecutionTime > 30000) health -= 20;
    else if (avgExecutionTime > 15000) health -= 10;
    
    return Math.max(0, Math.min(100, health));
  }

  private getTopPerformingAgents(count: number): AgentMetrics[] {
    return Array.from(this.metrics.values())
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, count);
  }

  private getSystemBottlenecks(): string[] {
    const bottlenecks = [];
    
    for (const [agentId, metrics] of this.metrics) {
      if (metrics.averageExecutionTime > this.alertThresholds.maxExecutionTime) {
        bottlenecks.push(agentId);
      }
    }
    
    return bottlenecks;
  }

  private calculateSystemTrends(): any {
    // Calculate system-wide trends
    return {
      overallPerformance: 'stable',
      resourceUsage: 'increasing',
      errorRate: 'stable'
    };
  }

  private generateSystemRecommendations(): string[] {
    const recommendations = [];
    const systemHealth = this.calculateSystemHealth();
    
    if (systemHealth < 80) {
      recommendations.push('System health below optimal - investigate agent performance');
    }
    
    const systemLoad = this.calculateSystemLoad();
    if (systemLoad > 80) {
      recommendations.push('High system load - consider load balancing');
    }
    
    return recommendations;
  }

  private calculatePerformanceGrade(metrics: AgentMetrics): string {
    let score = 0;
    
    // Success rate weight: 50%
    score += (metrics.successRate / 100) * 50;
    
    // Execution time weight: 30%
    const executionScore = Math.max(0, 30 - (metrics.averageExecutionTime / 1000));
    score += Math.min(30, executionScore);
    
    // Activity weight: 20%
    const isActive = this.isRecentlyActive(metrics.lastActivity);
    score += isActive ? 20 : 0;
    
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  private calculateWorkflowGrade(metrics: WorkflowMetrics): string {
    let score = 0;
    
    // Success rate: 60%
    score += (metrics.successRate / 100) * 60;
    
    // Duration: 40%
    const durationScore = Math.max(0, 40 - (metrics.averageDuration / 3000));
    score += Math.min(40, durationScore);
    
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  private priorityWeight(priority: string): number {
    const weights = { critical: 1, high: 2, medium: 3, low: 4 };
    return weights[priority] || 5;
  }

  private calculateEstimatedImpact(optimizations: Optimization[]): string {
    const criticalCount = optimizations.filter(o => o.priority === 'critical').length;
    const highCount = optimizations.filter(o => o.priority === 'high').length;
    
    if (criticalCount > 0) return 'High impact expected';
    if (highCount > 2) return 'Medium-high impact expected';
    return 'Medium impact expected';
  }

  private startPerformanceCollection(): void {
    // Start periodic performance data collection
    setInterval(() => {
      if (this.isMonitoring) {
        this.collectSystemMetrics();
      }
    }, 30000); // Every 30 seconds
  }

  private startAlertMonitoring(): void {
    // Start alert monitoring
    setInterval(() => {
      if (this.isMonitoring) {
        this.checkAllAlerts();
      }
    }, 10000); // Every 10 seconds
  }

  private collectSystemMetrics(): void {
    // Collect system-wide metrics
    const systemMetrics = {
      timestamp: new Date().toISOString(),
      activeAgents: Array.from(this.metrics.values()).filter(m => 
        this.isRecentlyActive(m.lastActivity)
      ).length,
      systemLoad: this.calculateSystemLoad(),
      systemHealth: this.calculateSystemHealth()
    };
    
    this.addPerformanceEntry({
      type: 'system_metrics',
      timestamp: systemMetrics.timestamp,
      success: true,
      metrics: systemMetrics
    });
  }

  private getActiveAlerts(agentId?: string): PerformanceAlert[] {
    // Get active alerts for specific agent or all agents
    const recentAlerts = this.performanceHistory
      .filter(entry => entry.type === 'alert' && entry.alert)
      .map(entry => entry.alert!)
      .filter(alert => {
        if (agentId && alert.agentId !== agentId) return false;
        // Alert is active if it's less than 1 hour old
        return (Date.now() - new Date(alert.timestamp).getTime()) < 60 * 60 * 1000;
      });
    
    return recentAlerts;
  }

  private getAllActiveAlerts(): PerformanceAlert[] {
    return this.getActiveAlerts();
  }
}

// Type definitions
export interface WorkflowMetrics {
  workflowId: string;
  executionCount: number;
  averageDuration: number;
  successRate: number;
  stepsCompleted: number;
  stepsTotal: number;
  lastExecution: string;
}

export interface PerformanceEntry {
  type: 'agent_execution' | 'workflow_execution' | 'alert' | 'system_metrics';
  timestamp: string;
  agentId?: string;
  workflowId?: string;
  executionTime?: number;
  success: boolean;
  error?: string;
  metrics?: any;
  alert?: PerformanceAlert;
}

export interface PerformanceAlert {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  agentId?: string;
  workflowId?: string;
  message: string;
  timestamp: string;
}

export interface AlertThresholds {
  maxExecutionTime: number;
  minSuccessRate: number;
  maxErrorRate: number;
  maxMemoryUsage: number;
  maxResponseTime: number;
}

export interface AgentPerformanceReport {
  agentId: string;
  currentMetrics: AgentMetrics;
  trends: PerformanceTrends;
  recommendations: string[];
  alerts: PerformanceAlert[];
  performanceGrade: string;
}

export interface WorkflowPerformanceReport {
  workflowId: string;
  currentMetrics: WorkflowMetrics;
  bottlenecks: string[];
  recommendations: string[];
  performanceGrade: string;
}

export interface SystemPerformanceReport {
  timestamp: string;
  overview: {
    totalAgents: number;
    activeAgents: number;
    totalWorkflows: number;
    systemLoad: number;
    overallHealth: number;
  };
  topPerformers: AgentMetrics[];
  bottlenecks: string[];
  trends: any;
  recommendations: string[];
}

export interface PerformanceTrends {
  executionTime: 'improving' | 'degrading' | 'stable';
  successRate: 'improving' | 'degrading' | 'stable';
  errorRate: 'improving' | 'degrading' | 'stable';
}

export interface Optimization {
  type: string;
  target: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  expectedImpact: string;
  actions: string[];
}

export interface OptimizationPlan {
  timestamp: string;
  systemHealth: number;
  totalOptimizations: number;
  optimizations: Optimization[];
  estimatedImpact: string;
}

export interface PerformanceExport {
  timestamp: string;
  agentMetrics: Record<string, AgentMetrics>;
  workflowMetrics: Record<string, WorkflowMetrics>;
  performanceHistory: PerformanceEntry[];
  systemHealth: number;
  alerts: PerformanceAlert[];
}