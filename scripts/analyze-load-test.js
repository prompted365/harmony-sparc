const fs = require('fs');
const path = require('path');

class LoadTestAnalyzer {
  constructor() {
    this.reportDir = path.join(__dirname, '../reports');
  }

  analyze() {
    console.log('📊 Analyzing load test results...');
    
    const summaryPath = path.join(this.reportDir, 'load-test-summary.json');
    
    if (!fs.existsSync(summaryPath)) {
      console.error('❌ No load test summary found!');
      process.exit(1);
    }
    
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    
    // Performance thresholds
    const thresholds = {
      minTPS: 1000,
      maxAvgResponseTime: 100, // ms
      maxP95: 500, // ms
      maxP99: 1000, // ms
      maxErrorRate: 5, // %
      minSuccessRate: 95 // %
    };
    
    const analysis = {
      timestamp: new Date().toISOString(),
      passed: true,
      issues: [],
      recommendations: [],
      performance: {
        tps: {
          actual: summary.peakTPS,
          target: thresholds.minTPS,
          status: summary.peakTPS >= thresholds.minTPS ? 'PASS' : 'FAIL'
        },
        responseTime: {
          actual: summary.avgResponseTime,
          target: thresholds.maxAvgResponseTime,
          status: summary.avgResponseTime <= thresholds.maxAvgResponseTime ? 'PASS' : 'FAIL'
        },
        p95: {
          actual: summary.p95,
          target: thresholds.maxP95,
          status: summary.p95 <= thresholds.maxP95 ? 'PASS' : 'FAIL'
        },
        p99: {
          actual: summary.p99,
          target: thresholds.maxP99,
          status: summary.p99 <= thresholds.maxP99 ? 'PASS' : 'FAIL'
        },
        errorRate: {
          actual: summary.errorRate,
          target: thresholds.maxErrorRate,
          status: summary.errorRate <= thresholds.maxErrorRate ? 'PASS' : 'FAIL'
        }
      }
    };
    
    // Check each metric
    if (summary.peakTPS < thresholds.minTPS) {
      analysis.passed = false;
      analysis.issues.push(`TPS too low: ${summary.peakTPS} < ${thresholds.minTPS}`);
      analysis.recommendations.push('Optimize database queries and caching');
      analysis.recommendations.push('Consider horizontal scaling');
    }
    
    if (summary.avgResponseTime > thresholds.maxAvgResponseTime) {
      analysis.passed = false;
      analysis.issues.push(`Average response time too high: ${summary.avgResponseTime}ms > ${thresholds.maxAvgResponseTime}ms`);
      analysis.recommendations.push('Profile and optimize slow endpoints');
      analysis.recommendations.push('Implement response caching');
    }
    
    if (summary.p95 > thresholds.maxP95) {
      analysis.passed = false;
      analysis.issues.push(`95th percentile too high: ${summary.p95}ms > ${thresholds.maxP95}ms`);
      analysis.recommendations.push('Investigate and fix performance outliers');
    }
    
    if (summary.p99 > thresholds.maxP99) {
      analysis.passed = false;
      analysis.issues.push(`99th percentile too high: ${summary.p99}ms > ${thresholds.maxP99}ms`);
      analysis.recommendations.push('Implement circuit breakers and timeouts');
    }
    
    if (summary.errorRate > thresholds.maxErrorRate) {
      analysis.passed = false;
      analysis.issues.push(`Error rate too high: ${summary.errorRate}% > ${thresholds.maxErrorRate}%`);
      analysis.recommendations.push('Investigate and fix error causes');
      analysis.recommendations.push('Implement better error handling');
    }
    
    // Analyze trends from detailed results
    const trends = this.analyzeTrends(summary.details);
    analysis.trends = trends;
    
    // Generate detailed report
    this.generateDetailedReport(analysis);
    
    // Output results
    console.log('\n📋 Load Test Analysis Results:');
    console.log(`   Overall Status: ${analysis.passed ? '✅ PASSED' : '❌ FAILED'}`);
    
    if (analysis.issues.length > 0) {
      console.log('\n❌ Issues Found:');
      analysis.issues.forEach(issue => console.log(`   - ${issue}`));
    }
    
    if (analysis.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      analysis.recommendations.forEach(rec => console.log(`   - ${rec}`));
    }
    
    console.log('\n📈 Performance Metrics:');
    Object.entries(analysis.performance).forEach(([metric, data]) => {
      console.log(`   ${metric}: ${data.actual} (target: ${data.target}) - ${data.status}`);
    });
    
    if (trends.degradation) {
      console.log('\n⚠️  Performance degradation detected under load');
    }
    
    return analysis.passed;
  }

  analyzeTrends(details) {
    if (!details || details.length < 2) {
      return { degradation: false, bottleneck: null };
    }
    
    // Sort by concurrency
    const sorted = details.sort((a, b) => a.concurrency - b.concurrency);
    
    // Check for performance degradation
    const degradation = this.checkDegradation(sorted);
    
    // Identify bottleneck point
    const bottleneck = this.findBottleneck(sorted);
    
    return {
      degradation,
      bottleneck,
      maxStableConcurrency: this.findMaxStableConcurrency(sorted)
    };
  }

  checkDegradation(results) {
    // Check if response times increase significantly with load
    if (results.length < 3) return false;
    
    const firstHalf = results.slice(0, Math.floor(results.length / 2));
    const secondHalf = results.slice(Math.floor(results.length / 2));
    
    const avgFirst = firstHalf.reduce((sum, r) => sum + (r.performance?.avgDuration || 0), 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((sum, r) => sum + (r.performance?.avgDuration || 0), 0) / secondHalf.length;
    
    return avgSecond > avgFirst * 1.5; // 50% increase indicates degradation
  }

  findBottleneck(results) {
    // Find the point where success rate drops below 95%
    for (let i = 0; i < results.length; i++) {
      if (results[i].successRate < 95) {
        return {
          concurrency: results[i].concurrency,
          successRate: results[i].successRate,
          responseTime: results[i].performance?.avgDuration || 0
        };
      }
    }
    return null;
  }

  findMaxStableConcurrency(results) {
    // Find the highest concurrency with >95% success rate
    for (let i = results.length - 1; i >= 0; i--) {
      if (results[i].successRate >= 95) {
        return results[i].concurrency;
      }
    }
    return 0;
  }

  generateDetailedReport(analysis) {
    const reportPath = path.join(this.reportDir, 'load-test-analysis.json');
    fs.writeFileSync(reportPath, JSON.stringify(analysis, null, 2));
    
    // Generate human-readable report
    const humanReport = this.generateHumanReport(analysis);
    fs.writeFileSync(
      path.join(this.reportDir, 'load-test-analysis.md'),
      humanReport
    );
  }

  generateHumanReport(analysis) {
    const timestamp = new Date(analysis.timestamp).toLocaleString();
    
    let report = `# Load Test Analysis Report\n\n`;
    report += `**Generated:** ${timestamp}\n\n`;
    report += `**Overall Status:** ${analysis.passed ? '✅ PASSED' : '❌ FAILED'}\n\n`;
    
    report += `## Performance Metrics\n\n`;
    report += `| Metric | Actual | Target | Status |\n`;
    report += `|--------|--------|--------|---------|\n`;
    
    Object.entries(analysis.performance).forEach(([metric, data]) => {
      const status = data.status === 'PASS' ? '✅' : '❌';
      report += `| ${metric} | ${data.actual} | ${data.target} | ${status} |\n`;
    });
    
    if (analysis.issues.length > 0) {
      report += `\n## Issues Found\n\n`;
      analysis.issues.forEach(issue => {
        report += `- ❌ ${issue}\n`;
      });
    }
    
    if (analysis.recommendations.length > 0) {
      report += `\n## Recommendations\n\n`;
      analysis.recommendations.forEach(rec => {
        report += `- 💡 ${rec}\n`;
      });
    }
    
    if (analysis.trends) {
      report += `\n## Performance Trends\n\n`;
      if (analysis.trends.degradation) {
        report += `- ⚠️ Performance degradation detected under load\n`;
      }
      if (analysis.trends.bottleneck) {
        report += `- 🔍 Bottleneck found at ${analysis.trends.bottleneck.concurrency} concurrent users\n`;
      }
      if (analysis.trends.maxStableConcurrency) {
        report += `- 📊 Maximum stable concurrency: ${analysis.trends.maxStableConcurrency} users\n`;
      }
    }
    
    return report;
  }
}

// Run analysis if this script is executed directly
if (require.main === module) {
  const analyzer = new LoadTestAnalyzer();
  const passed = analyzer.analyze();
  process.exit(passed ? 0 : 1);
}

module.exports = LoadTestAnalyzer;