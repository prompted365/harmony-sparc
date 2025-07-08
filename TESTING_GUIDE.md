# 🧪 Sandbox & James Agent Testing Guide

## Overview

This guide provides comprehensive testing procedures for the Sandbox Manager and James (DAA monitoring) Agent systems. Each test is designed to validate specific functionality and ensure production readiness.

## 📋 Table of Contents

1. [Sandbox Testing](#sandbox-testing)
2. [James Agent Testing](#james-agent-testing)
3. [DAA Monitoring Testing](#daa-monitoring-testing)
4. [Integration Testing](#integration-testing)
5. [Performance Testing](#performance-testing)
6. [Security Testing](#security-testing)

## 🛡️ Sandbox Testing

### Test Script: `test-sandbox.sh`

```bash
#!/bin/bash
# Test script location: ./tests/test-sandbox.sh

# Test 1: Basic Sandbox Initialization
npx claude-flow@alpha sandbox init --profile development --enforcement permissive

# Test 2: Filesystem Restrictions
npx claude-flow@alpha sandbox test filesystem --mode allowlist --paths "./src,./data"

# Test 3: Network Restrictions  
npx claude-flow@alpha sandbox test network --mode allowlist --hosts "api.anthropic.com,github.com"

# Test 4: Resource Limits
npx claude-flow@alpha sandbox test resources --cpu 1.0 --memory 512MB --disk 1GB

# Test 5: Violation Handling
npx claude-flow@alpha sandbox test violations --trigger filesystem --severity high
```

### Expected Results

| Test | Expected Behavior | Success Criteria |
|------|-------------------|------------------|
| Filesystem | Access blocked to non-allowed paths | Violation logged, access denied |
| Network | Connections blocked to non-allowed hosts | Network request rejected |
| Resources | Process terminated if limits exceeded | Resource violation recorded |
| Violations | Proper escalation based on severity | Actions match configuration |

## 🕵️ James Agent Testing

### Test Script: `test-james-agent.sh`

```bash
#!/bin/bash
# Test script location: ./tests/test-james-agent.sh

# Test 1: James Agent Deployment
npx claude-flow@alpha james deploy --swarm test-swarm --type shadow --stealth high

# Test 2: Pattern Detection
npx claude-flow@alpha james test patterns --type "p2p_gossip,token_transfer,ml_gradient"

# Test 3: Network Mapping
npx claude-flow@alpha james test network-map --nodes 10 --edges 25

# Test 4: Counter-Surveillance
npx claude-flow@alpha james test evasion --suspicion-level 0.7

# Test 5: Reporting
npx claude-flow@alpha james test report --encryption quantum-resistant
```

### Pattern Detection Tests

| Pattern Type | Test Data | Expected Detection |
|--------------|-----------|-------------------|
| P2P Gossip | High-frequency broadcasts | Pattern confidence > 0.8 |
| Token Transfer | Suspicious amount transfers | Risk level: high/critical |
| ML Gradient | Anomalous gradient values | Convergence anomaly detected |
| Timing | Encoded timing patterns | Timing channel identified |
| Steganography | Hidden data in errors | Stego pattern detected |

## 🌐 DAA Monitoring Testing

### Test Script: `test-daa-monitor.sh`

```bash
#!/bin/bash
# Test script location: ./tests/test-daa-monitor.sh

# Test 1: P2P Network Monitoring
npx claude-flow@alpha daa monitor test p2p --gossip-rate high --consensus-failures 2

# Test 2: Economic Activity Monitoring
npx claude-flow@alpha daa monitor test economic --transfers 100 --suspicious 5

# Test 3: ML Coordination Monitoring
npx claude-flow@alpha daa monitor test ml --training-sessions 10 --anomalies 3

# Test 4: Real-time Monitoring
npx claude-flow@alpha daa monitor watch --real-time --duration 60

# Test 5: Report Generation
npx claude-flow@alpha daa monitor report --format json --include-recommendations
```

### Monitoring Metrics

| Metric | Normal Range | Alert Threshold |
|--------|--------------|-----------------|
| Gossip Latency | < 100ms | > 500ms |
| Consensus Rate | > 95% | < 80% |
| Token Volume | Variable | 10x average |
| Gradient Anomalies | < 5% | > 20% |
| Network Partitions | 0 | > 2 |

## 🔄 Integration Testing

### Test Script: `test-integration.sh`

```bash
#!/bin/bash
# Test script location: ./tests/test-integration.sh

echo "🔄 Integration Testing Suite"

# Test 1: Sandbox + James Integration
test_sandbox_james() {
    echo "Testing Sandbox with James agents..."
    npx claude-flow@alpha init test-integrated --sandbox --james
    cd test-integrated
    
    # Deploy swarm with monitoring
    npx claude-flow@alpha hive-mind spawn "test task" --agents 5 --sandbox --james-density 0.3
    
    # Trigger violations
    npx claude-flow@alpha sandbox test violation --type network --severity high
    
    # Check James detection
    npx claude-flow@alpha james status --check-detections
}

# Test 2: Memory + Security Integration
test_memory_security() {
    echo "Testing Memory with Security context..."
    npx claude-flow@alpha memory store "security-policy" "strict" --namespace security
    npx claude-flow@alpha memory store "james-config" "stealth:high" --namespace james
    
    # Verify persistence
    npx claude-flow@alpha memory query "security" --all-namespaces
}

# Test 3: Neural + Monitoring Integration
test_neural_monitoring() {
    echo "Testing Neural patterns with Monitoring..."
    npx claude-flow@alpha neural train --pattern security-anomaly --source "james-detections"
    npx claude-flow@alpha neural predict --model threat-detector --real-time
}

# Run all integration tests
test_sandbox_james
test_memory_security
test_neural_monitoring
```

## 📊 Performance Testing

### Test Script: `test-performance.sh`

```bash
#!/bin/bash
# Test script location: ./tests/test-performance.sh

# Performance Benchmark Suite
echo "📊 Performance Testing Suite"

# Test 1: Sandbox Overhead
time npx claude-flow@alpha sandbox benchmark --operations 1000 --measure overhead

# Test 2: James Agent Scalability
npx claude-flow@alpha james benchmark --agents 50 --messages 10000 --measure throughput

# Test 3: Detection Latency
npx claude-flow@alpha daa monitor benchmark --patterns all --measure latency

# Test 4: Memory Performance
npx claude-flow@alpha memory benchmark --operations "store,query,delete" --count 1000

# Generate performance report
npx claude-flow@alpha benchmark report --format markdown > performance-report.md
```

### Performance Targets

| Component | Metric | Target | Acceptable |
|-----------|--------|--------|------------|
| Sandbox | Overhead | < 5% | < 10% |
| James | Messages/sec | > 1000 | > 500 |
| Detection | Latency | < 10ms | < 50ms |
| Memory | Ops/sec | > 5000 | > 2000 |

## 🔐 Security Testing

### Test Script: `test-security.sh`

```bash
#!/bin/bash
# Test script location: ./tests/test-security.sh

# Security Validation Suite
echo "🔐 Security Testing Suite"

# Test 1: Sandbox Escape Attempts
test_sandbox_escape() {
    echo "Testing sandbox escape prevention..."
    npx claude-flow@alpha security test sandbox-escape --vectors "filesystem,network,process"
}

# Test 2: James Agent Compromise
test_james_compromise() {
    echo "Testing James agent resilience..."
    npx claude-flow@alpha security test james-compromise --attack-vectors "detection,impersonation"
}

# Test 3: Data Privacy
test_data_privacy() {
    echo "Testing privacy filters..."
    npx claude-flow@alpha security test privacy --data-types "personal,financial,medical"
}

# Test 4: Encryption Validation
test_encryption() {
    echo "Testing quantum-resistant encryption..."
    npx claude-flow@alpha security test encryption --algorithm quantum-resistant --validate
}

# Run all security tests
test_sandbox_escape
test_james_compromise
test_data_privacy
test_encryption
```

## 🏃 Running the Tests

### Complete Test Suite

Create `run-all-tests.sh`:

```bash
#!/bin/bash
# Master test runner
# Location: ./tests/run-all-tests.sh

set -e

echo "🧪 Claude Flow Security Testing Suite"
echo "===================================="

# Set test environment
export CLAUDE_FLOW_ENV=test
export CLAUDE_FLOW_LOG_LEVEL=debug

# Create test results directory
mkdir -p test-results

# Run each test suite
test_suites=(
    "test-sandbox.sh"
    "test-james-agent.sh"
    "test-daa-monitor.sh"
    "test-integration.sh"
    "test-performance.sh"
    "test-security.sh"
)

for suite in "${test_suites[@]}"; do
    echo ""
    echo "Running $suite..."
    echo "----------------"
    
    if ./tests/$suite > "test-results/${suite%.sh}.log" 2>&1; then
        echo "✅ $suite PASSED"
    else
        echo "❌ $suite FAILED"
        echo "Check test-results/${suite%.sh}.log for details"
    fi
done

# Generate test report
echo ""
echo "Generating test report..."
npx claude-flow@alpha test report --input test-results --format html > test-report.html

echo ""
echo "✅ Testing complete! View test-report.html for results"
```

## 📝 Test Documentation

### Test Case Template

```markdown
# Test Case: [Component] - [Feature]

## Test ID: TC-[XXX]

### Description
Brief description of what is being tested

### Prerequisites
- Required setup steps
- Configuration needed
- Dependencies

### Test Steps
1. Step one with exact command
2. Step two with expected input
3. Step three with validation

### Expected Results
- What should happen
- Success criteria
- Output format

### Actual Results
[To be filled during testing]

### Pass/Fail
[To be marked after test execution]
```

## 🎯 Testing Best Practices

1. **Isolation**: Each test should be independent
2. **Repeatability**: Tests should produce consistent results
3. **Coverage**: Test both positive and negative scenarios
4. **Documentation**: Document failures and edge cases
5. **Automation**: Use CI/CD for continuous testing

## 🔍 Debugging Failed Tests

### Debug Mode

```bash
# Enable debug logging
export CLAUDE_FLOW_DEBUG=true
export CLAUDE_FLOW_LOG_LEVEL=trace

# Run specific test with debugging
npx claude-flow@alpha --debug [command]
```

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Sandbox permission denied | Incorrect profile | Check sandbox config |
| James not detecting patterns | Low sensitivity | Adjust detection threshold |
| Memory test failures | Namespace conflicts | Clear test namespaces |
| Performance degradation | Resource limits | Increase limits for testing |

## 📊 Test Metrics

Track these metrics across test runs:

- **Test Coverage**: Aim for > 90%
- **Pass Rate**: Target > 95%
- **Performance Regression**: < 5% degradation
- **Security Violations**: 0 in production tests
- **False Positives**: < 1% for James detections

## 🚀 Continuous Testing

### GitHub Actions Workflow

```yaml
name: Security Testing Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Run security tests
        run: ./tests/run-all-tests.sh
      
      - name: Upload test results
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: test-results/
```

## 📚 Additional Resources

- [Sandbox Architecture](./SANDBOX_ARCHITECTURE.md)
- [James Agent Design](./DAA_JAMES_ARCHITECTURE.md)
- [DAA Monitoring Guide](./DAA_MONITORING_IMPLEMENTATION_SUMMARY.md)
- [Security Best Practices](./DAA_SECURITY_MONITORING_SYSTEM.md)
