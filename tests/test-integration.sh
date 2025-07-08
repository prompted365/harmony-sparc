#!/bin/bash
# Integration Testing Suite
# Tests the integration between Sandbox, James, DAA monitoring, and other components

set -e

echo "🔄 Integration Testing Suite"
echo "==========================="

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Test results
PASSED=0
FAILED=0

# Test function
run_test() {
    local test_name="$1"
    local test_function="$2"
    
    echo -e "\n${BLUE}Testing: ${test_name}${NC}"
    
    if $test_function; then
        echo -e "${GREEN}✅ PASSED${NC}"
        ((PASSED++))
    else
        echo -e "${RED}❌ FAILED${NC}"
        ((FAILED++))
    fi
}

# Test 1: Sandbox + James Integration
test_sandbox_james() {
    echo "Testing Sandbox with James agents..."
    
    # Initialize project with both features
    npx claude-flow@alpha init test-integrated --sandbox --james || return 1
    cd test-integrated || return 1
    
    # Deploy swarm with monitoring
    npx claude-flow@alpha hive-mind spawn "Build secure API" \
        --agents 5 \
        --sandbox \
        --james-density 0.3 || return 1
    
    # Trigger sandbox violations
    npx claude-flow@alpha sandbox test violation --type network --severity high || return 1
    
    # Check James detection of violations
    npx claude-flow@alpha james status --check-detections || return 1
    
    # Verify integration metrics
    local james_count=$(npx claude-flow@alpha sandbox status --json | jq -r '.jamesAgents // 0')
    if [[ $james_count -eq 0 ]]; then
        echo "No James agents found in sandbox"
        return 1
    fi
    
    cd ..
    rm -rf test-integrated
    return 0
}

# Test 2: Memory + Security Integration
test_memory_security() {
    echo "Testing Memory with Security context..."
    
    # Store security policies in memory
    npx claude-flow@alpha memory store "security-policy" "strict" --namespace security || return 1
    npx claude-flow@alpha memory store "james-config" "stealth:high,type:shadow" --namespace james || return 1
    npx claude-flow@alpha memory store "sandbox-profile" "production" --namespace sandbox || return 1
    
    # Query across namespaces
    local results=$(npx claude-flow@alpha memory query "security" --all-namespaces --json)
    if [[ -z "$results" ]]; then
        echo "Failed to query security context from memory"
        return 1
    fi
    
    # Test persistence
    npx claude-flow@alpha memory export security-backup.json --namespace security || return 1
    npx claude-flow@alpha memory clear --namespace security || return 1
    npx claude-flow@alpha memory import security-backup.json || return 1
    
    # Verify restoration
    local restored=$(npx claude-flow@alpha memory get "security-policy" --namespace security)
    if [[ "$restored" != "strict" ]]; then
        echo "Failed to restore security context"
        return 1
    fi
    
    rm -f security-backup.json
    return 0
}

# Test 3: Neural + Monitoring Integration
test_neural_monitoring() {
    echo "Testing Neural patterns with Monitoring..."
    
    # Generate training data from James detections
    npx claude-flow@alpha james generate-training-data --output james-patterns.json || return 1
    
    # Train neural model on security patterns
    npx claude-flow@alpha neural train \
        --pattern security-anomaly \
        --data james-patterns.json \
        --epochs 10 || return 1
    
    # Use neural model for real-time threat detection
    npx claude-flow@alpha neural predict \
        --model security-anomaly \
        --input current-state.json \
        --real-time || return 1
    
    # Integrate predictions with monitoring
    npx claude-flow@alpha daa monitor integrate \
        --neural \
        --model security-anomaly \
        --enhance-detection || return 1
    
    rm -f james-patterns.json
    return 0
}

# Test 4: Workflow + Security Hooks
test_workflow_security() {
    echo "Testing Workflow with Security hooks..."
    
    # Create workflow with security hooks
    cat > secure-workflow.json << EOF
{
  "name": "Secure Development Pipeline",
  "steps": [
    {"name": "security-scan", "command": "claude-flow sandbox scan"},
    {"name": "deploy-james", "command": "claude-flow james deploy --auto"},
    {"name": "code-review", "command": "claude-flow github pr-manager review"},
    {"name": "monitor", "command": "claude-flow daa monitor watch --duration 300"}
  ],
  "hooks": {
    "pre-step": "claude-flow sandbox check --strict",
    "post-step": "claude-flow james report --summary",
    "on-failure": "claude-flow sandbox quarantine --all"
  }
}
EOF
    
    # Create and execute workflow
    npx claude-flow@alpha workflow create --config secure-workflow.json || return 1
    npx claude-flow@alpha workflow execute "Secure Development Pipeline" --test-mode || return 1
    
    # Verify workflow execution
    local status=$(npx claude-flow@alpha workflow status "Secure Development Pipeline" --json | jq -r '.status')
    if [[ "$status" != "completed" && "$status" != "running" ]]; then
        echo "Workflow execution failed"
        return 1
    fi
    
    rm -f secure-workflow.json
    return 0
}

# Test 5: GitHub + Security Integration
test_github_security() {
    echo "Testing GitHub integration with Security..."
    
    # Analyze repository with security focus
    npx claude-flow@alpha github gh-coordinator analyze \
        --analysis-type security \
        --james-enhanced \
        --target . || return 1
    
    # Create security-aware PR review
    npx claude-flow@alpha github pr-manager review \
        --security-scan \
        --james-validation \
        --test-mode || return 1
    
    # Test issue tracking with security labels
    npx claude-flow@alpha github issue-tracker manage \
        --security-labels \
        --auto-triage \
        --test-mode || return 1
    
    return 0
}

# Test 6: Hive-Mind + Full Stack Integration
test_hivemind_fullstack() {
    echo "Testing Hive-Mind with full security stack..."
    
    # Deploy hive-mind with all security features
    npx claude-flow@alpha hive-mind spawn "Build secure e-commerce platform" \
        --agents 8 \
        --sandbox \
        --james-density 0.25 \
        --neural-enhanced \
        --memory-namespace ecommerce \
        --test-mode || return 1
    
    # Monitor hive-mind activity
    npx claude-flow@alpha hive-mind status --detailed || return 1
    
    # Check integrated metrics
    local metrics=$(npx claude-flow@alpha hive-mind metrics --json)
    local sandbox_active=$(echo "$metrics" | jq -r '.sandbox.active // false')
    local james_active=$(echo "$metrics" | jq -r '.james.active // false')
    local neural_active=$(echo "$metrics" | jq -r '.neural.active // false')
    
    if [[ "$sandbox_active" != "true" || "$james_active" != "true" || "$neural_active" != "true" ]]; then
        echo "Not all security features are active in hive-mind"
        return 1
    fi
    
    return 0
}

# Test 7: Performance Under Security Load
test_performance_security() {
    echo "Testing performance with security features..."
    
    # Benchmark without security
    local baseline=$(npx claude-flow@alpha benchmark --task "simple-analysis" --measure time --json | jq -r '.time')
    
    # Benchmark with full security
    local secured=$(npx claude-flow@alpha benchmark \
        --task "simple-analysis" \
        --sandbox \
        --james \
        --measure time \
        --json | jq -r '.time')
    
    # Calculate overhead
    local overhead=$(echo "scale=2; (($secured - $baseline) / $baseline) * 100" | bc)
    echo "Security overhead: ${overhead}%"
    
    # Check if overhead is acceptable (< 20%)
    if (( $(echo "$overhead > 20" | bc -l) )); then
        echo "Security overhead too high: ${overhead}%"
        return 1
    fi
    
    return 0
}

# Test 8: Fault Tolerance
test_fault_tolerance() {
    echo "Testing fault tolerance with security..."
    
    # Test James agent recovery
    npx claude-flow@alpha james test fault --kill-agent --auto-recover || return 1
    
    # Test sandbox recovery
    npx claude-flow@alpha sandbox test fault --violation-overload --auto-recover || return 1
    
    # Test monitoring recovery
    npx claude-flow@alpha daa monitor test fault --network-partition --auto-recover || return 1
    
    # Verify system health after faults
    local health=$(npx claude-flow@alpha health check --all --json | jq -r '.status')
    if [[ "$health" != "healthy" ]]; then
        echo "System not healthy after fault recovery"
        return 1
    fi
    
    return 0
}

# Run all integration tests
echo -e "${GREEN}Running Integration Tests${NC}"
echo "========================="

run_test "Sandbox + James Integration" test_sandbox_james
run_test "Memory + Security Integration" test_memory_security
run_test "Neural + Monitoring Integration" test_neural_monitoring
run_test "Workflow + Security Hooks" test_workflow_security
run_test "GitHub + Security Integration" test_github_security
run_test "Hive-Mind + Full Stack" test_hivemind_fullstack
run_test "Performance Under Security Load" test_performance_security
run_test "Fault Tolerance" test_fault_tolerance

# Summary
echo -e "\n${GREEN}================================${NC}"
echo -e "${GREEN}Integration Test Summary${NC}"
echo -e "${GREEN}================================${NC}"
echo -e "Tests Passed: ${GREEN}${PASSED}${NC}"
echo -e "Tests Failed: ${RED}${FAILED}${NC}"

# Generate integration report
echo -e "\n${YELLOW}Generating integration report...${NC}"
npx claude-flow@alpha test report \
    --type integration \
    --include-metrics \
    --format json > integration-report.json

if [[ $FAILED -eq 0 ]]; then
    echo -e "\n${GREEN}🎉 All integration tests passed!${NC}"
    echo -e "${BLUE}Check integration-report.json for detailed metrics${NC}"
    exit 0
else
    echo -e "\n${RED}❌ Some integration tests failed. Please review the output.${NC}"
    exit 1
fi
