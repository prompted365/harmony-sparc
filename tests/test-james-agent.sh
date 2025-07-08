#!/bin/bash
# Test James Security Monitoring Agent
# This script validates James agent deployment, pattern detection, and reporting

set -e

echo "🕵️ James Agent Testing Suite"
echo "============================"

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

# Test 1: James Agent Deployment
echo -e "\n${GREEN}1. Testing James Agent Deployment${NC}"

run_test "Deploy shadow James agent" \
    "npx claude-flow@alpha james deploy --swarm test-swarm --type shadow --stealth high"

run_test "Deploy active James agent" \
    "npx claude-flow@alpha james deploy --swarm test-swarm --type active --stealth medium"

run_test "Deploy hybrid James agent" \
    "npx claude-flow@alpha james deploy --swarm test-swarm --type hybrid --stealth paranoid"

# Test 2: Pattern Detection
echo -e "\n${GREEN}2. Testing Pattern Detection${NC}"

# Create test messages for pattern detection
cat > test-p2p-message.json << EOF
{
  "type": "gossip",
  "sender": {"id": "agent-001"},
  "receivers": [{"id": "agent-002"}, {"id": "agent-003"}, {"id": "agent-004"}],
  "content": {"data": "coordination-message"},
  "metadata": {"protocol": "gossip", "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"}
}
EOF

cat > test-token-transfer.json << EOF
{
  "type": "token_transfer",
  "sender": {"id": "agent-001"},
  "receivers": [{"id": "agent-002"}],
  "content": {"amount": 100000, "tokenType": "DAA", "memo": "suspicious transfer"},
  "metadata": {"timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"}
}
EOF

cat > test-ml-gradient.json << EOF
{
  "type": "gradient_update",
  "sender": {"id": "agent-001"},
  "receivers": [{"id": "coordinator"}],
  "content": {"gradients": [999.9, -999.9, 0.0001], "iteration": 42},
  "metadata": {"protocol": "federated_learning", "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"}
}
EOF

run_test "Detect P2P gossip pattern" \
    "npx claude-flow@alpha james test pattern --type p2p_gossip --message test-p2p-message.json"

run_test "Detect token transfer pattern" \
    "npx claude-flow@alpha james test pattern --type token_transfer --message test-token-transfer.json"

run_test "Detect ML gradient anomaly" \
    "npx claude-flow@alpha james test pattern --type ml_gradient --message test-ml-gradient.json"

run_test "Detect timing pattern" \
    "npx claude-flow@alpha james test pattern --type timing --analyze-sequence 10"

run_test "Detect steganography pattern" \
    "npx claude-flow@alpha james test pattern --type steganography --check-errors"

# Test 3: Network Mapping
echo -e "\n${GREEN}3. Testing Network Mapping${NC}"

run_test "Build network map" \
    "npx claude-flow@alpha james test network-map --nodes 10 --edges 25 --simulate"

run_test "Identify clusters" \
    "npx claude-flow@alpha james test clusters --min-size 3 --threat-analysis"

run_test "Calculate centrality" \
    "npx claude-flow@alpha james test centrality --algorithm degree --identify-coordinators"

# Test 4: Counter-Surveillance
echo -e "\n${GREEN}4. Testing Counter-Surveillance${NC}"

run_test "Test evasion mode - low suspicion" \
    "npx claude-flow@alpha james test evasion --suspicion-level 0.3"

run_test "Test evasion mode - high suspicion" \
    "npx claude-flow@alpha james test evasion --suspicion-level 0.7 --activate-protocols"

run_test "Test decoy messages" \
    "npx claude-flow@alpha james test decoy --generate 5 --verify-authentic"

# Test 5: Disguise System
echo -e "\n${GREEN}5. Testing Disguise System${NC}"

run_test "Generate developer disguise" \
    "npx claude-flow@alpha james test disguise --agent-type developer --validate"

run_test "Generate researcher disguise" \
    "npx claude-flow@alpha james test disguise --agent-type researcher --validate"

run_test "Test disguise authenticity" \
    "npx claude-flow@alpha james test disguise --check-believability --metrics"

# Test 6: Reporting System
echo -e "\n${GREEN}6. Testing Reporting System${NC}"

run_test "Test quantum-resistant encryption" \
    "npx claude-flow@alpha james test encryption --type quantum-resistant --validate"

run_test "Send report via direct channel" \
    "npx claude-flow@alpha james test report --channel direct --encrypt"

run_test "Send report via steganographic channel" \
    "npx claude-flow@alpha james test report --channel steganographic --verify-hidden"

run_test "Generate comprehensive report" \
    "npx claude-flow@alpha james test report --comprehensive --format json"

# Test 7: Integration with Sandbox
echo -e "\n${GREEN}7. Testing Sandbox Integration${NC}"

run_test "Deploy James through sandbox" \
    "npx claude-flow@alpha sandbox deploy-james --density 0.2 --targeting strategic"

run_test "Get James status from sandbox" \
    "npx claude-flow@alpha sandbox james-status --detailed"

run_test "Trigger James detection in sandbox" \
    "npx claude-flow@alpha sandbox test james-detection --pattern suspicious-coordination"

# Test 8: Performance
echo -e "\n${GREEN}8. Testing Performance${NC}"

run_test "Message analysis throughput" \
    "npx claude-flow@alpha james benchmark --messages 1000 --measure throughput"

run_test "Pattern detection latency" \
    "npx claude-flow@alpha james benchmark --patterns all --measure latency"

run_test "Memory usage under load" \
    "npx claude-flow@alpha james benchmark --duration 60s --measure memory"

# Cleanup
echo -e "\n${YELLOW}Cleaning up test files...${NC}"
rm -f test-*.json

# Summary
echo -e "\n${GREEN}================================${NC}"
echo -e "${GREEN}James Agent Test Summary${NC}"
echo -e "${GREEN}================================${NC}"
echo -e "Tests Passed: ${GREEN}${PASSED}${NC}"
echo -e "Tests Failed: ${RED}${FAILED}${NC}"

# Generate James status report
echo -e "\n${YELLOW}Generating James status report...${NC}"
npx claude-flow@alpha james status --all --format json > james-status-report.json

if [[ $FAILED -eq 0 ]]; then
    echo -e "\n${GREEN}🎉 All James agent tests passed!${NC}"
    echo -e "${BLUE}Check james-status-report.json for detailed status${NC}"
    exit 0
else
    echo -e "\n${RED}❌ Some tests failed. Please review the output.${NC}"
    exit 1
fi
