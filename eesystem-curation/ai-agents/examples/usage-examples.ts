/**
 * Usage Examples - EESystem AI Agent Platform
 * Demonstrates how to use the AI agent orchestration system
 */

import { EESystemAIAgentPlatform } from '../index';

/**
 * Example 1: Basic Content Generation
 * Generate a single Instagram Reel following EESystem brand guidelines
 */
async function exampleBasicContentGeneration() {
  console.log('🎬 Example 1: Basic Content Generation');
  
  // Initialize the platform
  const platform = new EESystemAIAgentPlatform();
  await platform.initialize();
  
  try {
    // Generate Instagram Reel
    const reelResult = await platform.generateInstagramReel(
      'Clear the Noise',
      'Your body\'s where noise begins—tension, fatigue, clutter. Time to clear it all.'
    );
    
    console.log('Instagram Reel Generated:');
    console.log('- Script:', reelResult.content.script?.title);
    console.log('- Caption:', reelResult.content.caption?.mainCaption?.substring(0, 100) + '...');
    console.log('- Media Prompt:', reelResult.content.mediaPrompt?.prompt?.substring(0, 100) + '...');
    console.log('- Brand Alignment:', reelResult.analysis.brandAlignment + '%');
    console.log('- Compliance Score:', reelResult.analysis.complianceScore + '%');
    console.log('- Approved:', reelResult.publishing.approved);
    
  } catch (error) {
    console.error('Error generating content:', error.message);
  }
}

/**
 * Example 2: Multi-Platform Content Generation
 * Generate content for multiple platforms simultaneously
 */
async function exampleMultiPlatformGeneration() {
  console.log('🌐 Example 2: Multi-Platform Content Generation');
  
  const platform = new EESystemAIAgentPlatform();
  await platform.initialize();
  
  try {
    // Generate content for multiple platforms in parallel
    const [reelResult, shortResult, carouselResult] = await Promise.all([
      platform.generateInstagramReel(
        'Wash the Mud',
        'From noise to clarity—watch the transformation unfold.'
      ),
      platform.generateTikTokShort(
        'Wash the Mud',
        'Noise fades, clarity shines. Scalar makes it simple.'
      ),
      platform.generateCarousel(
        'Scalar Field Effects',
        ['Physical Clutter', 'Energetic Static', 'Emotional Weight']
      )
    ]);
    
    console.log('Multi-Platform Content Generated:');
    console.log('📱 Instagram Reel - Brand Alignment:', reelResult.analysis.brandAlignment + '%');
    console.log('🎵 TikTok Short - Brand Alignment:', shortResult.analysis.brandAlignment + '%');
    console.log('🖼️ Carousel - Brand Alignment:', carouselResult.analysis.brandAlignment + '%');
    
    // Get overall compliance report
    const complianceReport = await platform.getBrandComplianceReport();
    console.log('📊 Overall Compliance:', complianceReport.overallCompliance + '%');
    console.log('🎯 Overall Brand Alignment:', complianceReport.overallBrandAlignment + '%');
    
  } catch (error) {
    console.error('Error in multi-platform generation:', error.message);
  }
}

/**
 * Example 3: Daily Publication Schedule Execution
 * Execute the complete publication schedule for a specific day
 */
async function exampleDailyScheduleExecution() {
  console.log('📅 Example 3: Daily Publication Schedule Execution');
  
  const platform = new EESystemAIAgentPlatform();
  await platform.initialize();
  
  try {
    // Execute publication schedule for July 7, 2025
    const scheduleResults = await platform.executePublicationSchedule('2025-07-07');
    
    console.log(`📋 Publication Schedule Executed for July 7, 2025:`);
    console.log(`- Total Content Items: ${scheduleResults.length}`);
    
    scheduleResults.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.request.contentType} (${result.request.platform})`);
      console.log(`   Theme: ${result.request.theme}`);
      console.log(`   Brand Alignment: ${result.analysis.brandAlignment}%`);
      console.log(`   Compliance: ${result.analysis.complianceScore}%`);
      console.log(`   Approved: ${result.publishing.approved ? '✅' : '❌'}`);
      
      if (result.analysis.recommendations.length > 0) {
        console.log(`   Recommendations: ${result.analysis.recommendations.slice(0, 2).join(', ')}`);
      }
    });
    
  } catch (error) {
    console.error('Error executing daily schedule:', error.message);
  }
}

/**
 * Example 4: Performance Monitoring and Optimization
 * Monitor agent performance and get optimization recommendations
 */
async function examplePerformanceMonitoring() {
  console.log('📊 Example 4: Performance Monitoring and Optimization');
  
  const platform = new EESystemAIAgentPlatform();
  await platform.initialize();
  
  // Generate some content to create performance data
  await platform.generateInstagramReel('Coherence & Clarity', 'Find your center with scalar field technology.');
  await platform.generateTikTokShort('Clear the Noise', 'Start fresh with scalar energy.');
  
  try {
    // Get agent status
    const agentStatus = await platform.getAgentStatus();
    console.log('🤖 Agent Status:');
    console.log('- Total Agents:', agentStatus.orchestrator.totalAgents);
    console.log('- Active Agents:', agentStatus.performance.overview.activeAgents);
    console.log('- System Health:', agentStatus.performance.overview.overallHealth + '%');
    console.log('- System Load:', agentStatus.performance.overview.systemLoad + '%');
    
    // Get performance analytics
    const analytics = await platform.getPerformanceAnalytics();
    console.log('\n📈 Performance Analytics:');
    console.log('- Health Score:', analytics.healthScore + '%');
    console.log('- Total Optimizations Available:', analytics.optimizationPlan.totalOptimizations);
    console.log('- Expected Impact:', analytics.optimizationPlan.estimatedImpact);
    
    if (analytics.optimizationPlan.optimizations.length > 0) {
      console.log('\n🔧 Top Optimization Recommendations:');
      analytics.optimizationPlan.optimizations.slice(0, 3).forEach((opt, index) => {
        console.log(`${index + 1}. ${opt.description} (${opt.priority} priority)`);
        console.log(`   Expected: ${opt.expectedImpact}`);
      });
    }
    
  } catch (error) {
    console.error('Error monitoring performance:', error.message);
  }
}

/**
 * Example 5: Brand Compliance and Quality Assurance
 * Demonstrate compliance checking and quality assurance workflows
 */
async function exampleBrandCompliance() {
  console.log('🛡️ Example 5: Brand Compliance and Quality Assurance');
  
  const platform = new EESystemAIAgentPlatform();
  await platform.initialize();
  
  try {
    // Generate content with compliance checking
    const quoteResult = await platform.generateQuotePost(
      'Coherence & Clarity',
      'The field subtracts noise, not adds magic. Choose clarity today.'
    );
    
    console.log('📝 Quote Post Generated:');
    console.log('- Content:', quoteResult.content.caption?.mainCaption);
    console.log('- Compliance Score:', quoteResult.analysis.complianceScore + '%');
    console.log('- Brand Alignment:', quoteResult.analysis.brandAlignment + '%');
    console.log('- Quality Score:', quoteResult.analysis.qualityScore + '%');
    
    // Get detailed compliance report
    const complianceReport = await platform.getBrandComplianceReport();
    console.log('\n📊 Brand Compliance Report:');
    console.log('- Overall Compliance:', complianceReport.overallCompliance + '%');
    console.log('- Overall Brand Alignment:', complianceReport.overallBrandAlignment + '%');
    console.log('- Status:', complianceReport.status);
    
    if (complianceReport.recommendations.length > 0) {
      console.log('\n💡 Compliance Recommendations:');
      complianceReport.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
    }
    
    console.log('\n📋 Content Scores:');
    complianceReport.contentScores.forEach(score => {
      console.log(`- ${score.type}: ${score.score}% compliance, ${score.brandAlignment}% brand alignment`);
    });
    
  } catch (error) {
    console.error('Error in compliance checking:', error.message);
  }
}

/**
 * Example 6: Memory Coordination and Agent Communication
 * Demonstrate how agents share memory and coordinate
 */
async function exampleMemoryCoordination() {
  console.log('🧠 Example 6: Memory Coordination and Agent Communication');
  
  const platform = new EESystemAIAgentPlatform();
  await platform.initialize();
  
  try {
    // Generate content to trigger agent coordination
    const reelResult = await platform.generateInstagramReel(
      'Scalar Field Effects',
      'Scalar energy helps release what\'s stuck in your body.'
    );
    
    // Get platform status to see memory usage
    const status = await platform.getAgentStatus();
    console.log('🔗 Memory Coordination Status:');
    console.log('- Memory Entries:', status.coordination.memoryEntries);
    console.log('- Active Workflows:', status.coordination.activeWorkflows);
    
    console.log('\n🤖 Agent Coordination Results:');
    console.log('- Research → Curation coordination: ✅');
    console.log('- Content Generation coordination: ✅');
    console.log('- Quality Assurance coordination: ✅');
    console.log('- Publishing coordination: ✅');
    
    console.log('\n📊 Workflow Execution:');
    console.log('- Phases completed:', Object.keys(reelResult.metadata.phaseResults).filter(
      phase => reelResult.metadata.phaseResults[phase]
    ).length + '/5');
    console.log('- Agents used:', reelResult.metadata.agentsUsed.length);
    console.log('- Execution time:', reelResult.metadata.executionTime + 'ms');
    
  } catch (error) {
    console.error('Error in memory coordination:', error.message);
  }
}

/**
 * Example 7: Data Export and Backup
 * Export platform data for backup or analysis
 */
async function exampleDataExport() {
  console.log('💾 Example 7: Data Export and Backup');
  
  const platform = new EESystemAIAgentPlatform();
  await platform.initialize();
  
  // Generate some content first
  await platform.generateInstagramReel('Clear the Noise', 'Clear the deck—your body's first.');
  
  try {
    // Export platform data
    const exportData = await platform.exportPlatformData();
    
    console.log('📦 Platform Data Export:');
    console.log('- Export timestamp:', exportData.timestamp);
    console.log('- Platform version:', exportData.version);
    console.log('- Agent count:', exportData.agentStatus.totalAgents);
    console.log('- Memory entries:', exportData.memorySnapshot.stats.totalMemorySize);
    console.log('- Performance entries:', exportData.performanceData.performanceHistory.length);
    
    console.log('\n📄 Recent Content:');
    Object.entries(exportData.recentContent).forEach(([type, content]) => {
      if (content) {
        console.log(`- ${type}: ✅ Available`);
      } else {
        console.log(`- ${type}: ❌ Not generated`);
      }
    });
    
    // Perform cleanup
    const cleanupResult = await platform.cleanup();
    console.log('\n🧹 Cleanup Results:');
    console.log('- Performance entries removed:', cleanupResult.performanceEntriesRemoved);
    console.log('- Memory entries removed:', cleanupResult.memoryEntriesRemoved);
    console.log('- Total removed:', cleanupResult.totalRemoved);
    
  } catch (error) {
    console.error('Error in data export:', error.message);
  }
}

/**
 * Run all examples
 */
async function runAllExamples() {
  console.log('🚀 Running EESystem AI Agent Platform Examples\n');
  
  const examples = [
    exampleBasicContentGeneration,
    exampleMultiPlatformGeneration,
    exampleDailyScheduleExecution,
    examplePerformanceMonitoring,
    exampleBrandCompliance,
    exampleMemoryCoordination,
    exampleDataExport
  ];
  
  for (let i = 0; i < examples.length; i++) {
    try {
      await examples[i]();
      console.log(`\n${'='.repeat(80)}\n`);
    } catch (error) {
      console.error(`Example ${i + 1} failed:`, error.message);
      console.log(`\n${'='.repeat(80)}\n`);
    }
  }
  
  console.log('✅ All examples completed!');
}

// Export examples for testing
export {
  exampleBasicContentGeneration,
  exampleMultiPlatformGeneration,
  exampleDailyScheduleExecution,
  examplePerformanceMonitoring,
  exampleBrandCompliance,
  exampleMemoryCoordination,
  exampleDataExport,
  runAllExamples
};

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}