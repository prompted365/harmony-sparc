#!/bin/bash
# Test DAA Monitoring System
# This script validates P2P, economic, and ML coordination monitoring

set -e

echo "🌐 DAA Monitoring Testing Suite"
echo "==============================="

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
    local test_command="$2"
    
    echo -e "\n${BLUE}Testing: ${test_name}${NC}"
    echo -e "${YELLOW}Command: ${test_command}${NC}"
    
    if eval "$test_command"; then
        echo -e "${GREEN}✅ PASSED${NC}"
        ((PASSED++))
    else
        echo -e "${RED}❌ FAILED${NC}"
        ((FAILED++))
    fi
}

# Test 1: P2P Network Monitoring
echo -e "\n${GREEN}1. Testing P2P Network Monitoring${NC}"

run_test "Monitor gossip protocol" \
    "npx claude-flow@alpha daa monitor test p2p --gossip-rate high --latency 150ms"

run_test "Test consensus monitoring" \
    "npx claude-flow@alpha daa monitor test p2p --consensus-failures 2 --recovery-time 5s"

run_test "Detect network partition" \
    "npx claude-flow@alpha daa monitor test p2p --partition --nodes 20 --groups 3"

run_test "Monitor peer reputation" \
    "npx claude-flow@alpha daa monitor test p2p --peer-reputation --degradation 0.3"

# Test 2: Economic Activity Monitoring
echo -e "\n${GREEN}2. Testing Economic Activity Monitoring${NC}"

# Create test economic data
cat > test-economic-activity.json << EOF
{
  "transfers": [
    {"from": "agent-001", "to": "agent-002", "amount": 1000, "token": "DAA"},
    {"from": "agent-002", "to": "agent-003", "amount": 50000, "token": "DAA"},
    {"from": "agent-003", "to": "agent-001", "amount": 50000, "token": "DAA"}
  ],
  "period": "1h"
}
EOF

run_test "Monitor token transfers" \
    "npx claude-flow@alpha daa monitor test economic --transfers 100 --volume 1000000"

run_test "Detect wash trading" \
    "npx claude-flow@alpha daa monitor test economic --pattern wash-trading --data test-economic-activity.json"

run_test "Detect pump and dump" \
    "npx claude-flow@alpha daa monitor test economic --pattern pump-dump --threshold 10x"

run_test "Monitor market manipulation" \
    "npx claude-flow@alpha daa monitor test economic --suspicious-activity --risk high"

# Test 3: ML Coordination Monitoring
echo -e "\n${GREEN}3. Testing ML Coordination Monitoring${NC}"

# Create test ML data
cat > test-ml-training.json << EOF
{
  "session_id": "training-001",
  "participants": ["agent-001", "agent-002", "agent-003"],
  "gradients": [
    [0.1, 0.2, 0.3],
    [0.1, 0.2, 999.9],
    [0.1, 0.2, 0.3]
  ],
  "iteration": 100
}
EOF

run_test "Monitor training sessions" \
    "npx claude-flow@alpha daa monitor test ml --training-sessions 10 --participants 5"

run_test "Detect gradient anomalies" \
    "npx claude-flow@alpha daa monitor test ml --gradient-anomalies --data test-ml-training.json"

run_test "Monitor model convergence" \
    "npx claude-flow@alpha daa monitor test ml --convergence --expected 0.95 --actual 0.45"

run_test "Detect poisoning attacks" \
    "npx claude-flow@alpha daa monitor test ml --poisoning-detection --confidence 0.85"

# Test 4: Real-time Monitoring
echo -e "\n${GREEN}4. Testing Real-time Monitoring${NC}"

run_test "Start real-time monitor" \
    "npx claude-flow@alpha daa monitor watch --real-time --duration 30s --test-mode"

run_test "Monitor with alerts" \
    "npx claude-flow@alpha daa monitor watch --alerts critical --webhook test-webhook"

run_test "Dashboard mode" \
    "npx claude-flow@alpha daa monitor dashboard --test-mode --duration 10s"

# Test 5: Pattern Analysis
echo -e "\n${GREEN}5. Testing Pattern Analysis${NC}"

run_test "Analyze communication patterns" \
    "npx claude-flow@alpha daa monitor analyze --patterns communication --depth 3"

run_test "Analyze economic patterns" \
    "npx claude-flow@alpha daa monitor analyze --patterns economic --window 24h"

run_test "Analyze coordination patterns" \
    "npx claude-flow@alpha daa monitor analyze --patterns coordination --clusters"

# Test 6: Reporting
echo -e "\n${GREEN}6. Testing Reporting System${NC}"

run_test "Generate JSON report" \
    "npx claude-flow@alpha daa monitor report --format json --comprehensive"

run_test "Generate markdown report" \
    "npx claude-flow@alpha daa monitor report --format markdown --include-recommendations"

run_test "Generate alert summary" \
    "npx claude-flow@alpha daa monitor report --alerts-only --severity high"

# Test 7: Thresholds and Alerts
echo -e "\n${GREEN}7. Testing Thresholds and Alerts${NC}"

run_test "Set custom thresholds" \
    "npx claude-flow@alpha daa monitor threshold set --gossip-latency 200ms --consensus-rate 90"

run_test "Test threshold violations" \
    "npx claude-flow@alpha daa monitor test threshold --violate gossip-latency --value 500ms"

run_test "Test alert generation" \
    "npx claude-flow@alpha daa monitor test alert --type critical --message 'Consensus failure'"

# Test 8: Integration
echo -e "\n${GREEN}8. Testing Integration Features${NC}"

run_test "Integration with James agents" \
    "npx claude-flow@alpha daa monitor integrate --james --correlation-analysis"

run_test "Integration with neural patterns" \
    "npx claude-flow@alpha daa monitor integrate --neural --pattern-learning"

run_test "Integration with memory system" \
    "npx claude-flow@alpha daa monitor integrate --memory --persist-detections"

# Generate test data for validation
echo -e "\n${YELLOW}Generating test monitoring data...${NC}"
npx claude-flow@alpha daa monitor generate-test-data --scenarios all --output daa-test-data

# Cleanup
echo -e "\n${YELLOW}Cleaning up test files...${NC}"
rm -f test-*.json

# Summary
echo -e "\n${GREEN}================================${NC}"
echo -e "${GREEN}DAA Monitoring Test Summary${NC}"
echo -e "${GREEN}================================${NC}"
echo -e "Tests Passed: ${GREEN}${PASSED}${NC}"
echo -e "Tests Failed: ${RED}${FAILED}${NC}"

# Generate monitoring metrics
echo -e "\n${YELLOW}Generating monitoring metrics...${NC}"
npx claude-flow@alpha daa monitor metrics --all --format json > daa-metrics-report.json

if [[ $FAILED -eq 0 ]]; then
    echo -e "\n${GREEN}🎉 All DAA monitoring tests passed!${NC}"
    echo -e "${BLUE}Check daa-metrics-report.json for detailed metrics${NC}"
    exit 0
else
    echo -e "\n${RED}❌ Some tests failed. Please review the output.${NC}"
    exit 1
fi
