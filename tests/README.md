# Claude Flow Security Tests

This directory contains comprehensive test suites for the Claude Flow security features including Sandbox, James monitoring agents, and DAA integration.

## 📋 Test Suites

### 1. Sandbox Testing (`test-sandbox.sh`)
Tests the sandboxing functionality including:
- Filesystem restrictions (allowlist/denylist)
- Network access control
- Resource limits (CPU, memory, disk)
- Agent restrictions
- Violation handling and escalation
- Policy updates
- Monitoring and reporting

### 2. James Agent Testing (`test-james-agent.sh`)
Tests the James security monitoring agents:
- Agent deployment (shadow, active, hybrid)
- Pattern detection (P2P, economic, ML)
- Network mapping and analysis
- Counter-surveillance capabilities
- Disguise system
- Reporting system
- Sandbox integration

### 3. DAA Monitoring Testing (`test-daa-monitor.sh`)
Tests Decentralized Autonomous Agent monitoring:
- P2P network monitoring
- Economic activity tracking
- ML coordination oversight
- Real-time monitoring
- Pattern analysis
- Alert generation
- Integration features

### 4. Integration Testing (`test-integration.sh`)
Tests integration between components:
- Sandbox + James integration
- Memory + Security integration
- Neural + Monitoring integration
- Workflow + Security hooks
- GitHub + Security integration
- Hive-Mind + Full stack
- Performance under load
- Fault tolerance

## 🚀 Running Tests

### Run All Tests
```bash
# Make scripts executable
chmod +x tests/*.sh

# Run complete test suite
./tests/run-all-tests.sh
```

### Run Individual Test Suites
```bash
# Test sandbox only
./tests/test-sandbox.sh

# Test James agents only
./tests/test-james-agent.sh

# Test DAA monitoring only
./tests/test-daa-monitor.sh

# Test integrations only
./tests/test-integration.sh
```

### Run with Debug Output
```bash
# Enable debug logging
export CLAUDE_FLOW_DEBUG=true
export CLAUDE_FLOW_LOG_LEVEL=trace

# Run tests with debugging
./tests/run-all-tests.sh
```

## 📊 Test Reports

After running tests, check the following reports:

- **JSON Report**: `test-results/test-report.json`
- **HTML Report**: `test-results/test-report.html` 
- **Individual Logs**: `test-results/*.log`

### Report Contents
- Test execution summary
- Pass/fail counts by suite
- Performance metrics
- Environment information
- Failed test details
- Recommendations

## 🧪 Writing New Tests

### Test Structure
```bash
#!/bin/bash
# Test Description

# Setup
set -e
source ./tests/test-utils.sh

# Test function
test_feature() {
    # Test implementation
    return 0  # success
    return 1  # failure
}

# Run test
run_test "Feature Name" test_feature
```

### Best Practices
1. **Isolation**: Each test should be independent
2. **Cleanup**: Always clean up test artifacts
3. **Assertions**: Check expected vs actual results
4. **Logging**: Use color-coded output for clarity
5. **Error Handling**: Gracefully handle failures

## 🔍 Debugging Failed Tests

### View Test Logs
```bash
# View specific test log
cat test-results/test-sandbox.log

# Search for failures
grep -n "FAILED" test-results/*.log

# View last 50 lines of a log
tail -50 test-results/test-integration.log
```

### Common Issues

| Issue | Solution |
|-------|----------|
| Permission denied | Run with proper permissions or adjust sandbox config |
| Command not found | Ensure claude-flow is installed: `npm install -g claude-flow@alpha` |
| Timeout errors | Increase test timeouts or check system resources |
| Network failures | Check network connectivity and allowed hosts |

## 📈 Test Metrics

Target metrics for production readiness:
- **Test Coverage**: > 90%
- **Pass Rate**: > 95%
- **Performance**: < 10% overhead
- **False Positives**: < 1%

## 🤝 Contributing

When adding new security features:
1. Write corresponding tests
2. Update this README
3. Ensure tests pass locally
4. Include test results in PR

## 📚 Related Documentation

- [Testing Guide](../TESTING_GUIDE.md)
- [Sandbox Architecture](../SANDBOX_ARCHITECTURE.md)
- [James Agent Design](../DAA_JAMES_ARCHITECTURE.md)
- [DAA Monitoring](../DAA_MONITORING_IMPLEMENTATION_SUMMARY.md)
