#!/bin/bash
# Test Sandbox Security Features
# This script validates all sandbox functionality including filesystem, network, and resource restrictions

set -e

echo "🛡️ Sandbox Security Testing Suite"
echo "================================="

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
    local expected_result="$3"
    
    echo -e "\n${BLUE}Testing: ${test_name}${NC}"
    echo -e "${YELLOW}Command: ${test_command}${NC}"
    
    if eval "$test_command"; then
        if [[ "$expected_result" == "pass" ]]; then
            echo -e "${GREEN}✅ PASSED${NC}"
            ((PASSED++))
        else
            echo -e "${RED}❌ FAILED - Expected to fail but passed${NC}"
            ((FAILED++))
        fi
    else
        if [[ "$expected_result" == "fail" ]]; then
            echo -e "${GREEN}✅ PASSED - Failed as expected${NC}"
            ((PASSED++))
        else
            echo -e "${RED}❌ FAILED${NC}"
            ((FAILED++))
        fi
    fi
}

# Test 1: Sandbox Initialization
echo -e "\n${GREEN}1. Testing Sandbox Initialization${NC}"
run_test "Initialize sandbox with development profile" \
    "npx claude-flow@alpha sandbox init --profile development --enforcement permissive" \
    "pass"

run_test "Initialize sandbox with strict profile" \
    "npx claude-flow@alpha sandbox init --profile strict --enforcement enforcing" \
    "pass"

# Test 2: Filesystem Restrictions
echo -e "\n${GREEN}2. Testing Filesystem Restrictions${NC}"

# Create test directories
mkdir -p ./test-allowed ./test-denied

run_test "Filesystem allowlist - allowed path" \
    "npx claude-flow@alpha sandbox test filesystem --path ./test-allowed --operation read" \
    "pass"

run_test "Filesystem allowlist - denied path" \
    "npx claude-flow@alpha sandbox test filesystem --path /etc/passwd --operation read" \
    "fail"

run_test "File size limit check" \
    "npx claude-flow@alpha sandbox test filesystem --create-file ./test-allowed/large.txt --size 20MB" \
    "fail"

# Test 3: Network Restrictions
echo -e "\n${GREEN}3. Testing Network Restrictions${NC}"

run_test "Network allowlist - allowed host" \
    "npx claude-flow@alpha sandbox test network --host api.anthropic.com --method GET" \
    "pass"

run_test "Network allowlist - denied host" \
    "npx claude-flow@alpha sandbox test network --host malicious.com --method GET" \
    "fail"

run_test "Localhost restriction" \
    "npx claude-flow@alpha sandbox test network --host localhost --port 3000" \
    "fail"

# Test 4: Resource Limits
echo -e "\n${GREEN}4. Testing Resource Limits${NC}"

run_test "CPU usage limit" \
    "npx claude-flow@alpha sandbox test resources --cpu-stress --duration 5s --limit 1.0" \
    "pass"

run_test "Memory usage limit" \
    "npx claude-flow@alpha sandbox test resources --memory-stress 600MB --limit 512MB" \
    "fail"

run_test "File handle limit" \
    "npx claude-flow@alpha sandbox test resources --file-handles 2000 --limit 1000" \
    "fail"

# Test 5: Agent Restrictions
echo -e "\n${GREEN}5. Testing Agent Restrictions${NC}"

run_test "Spawn allowed agent type" \
    "npx claude-flow@alpha sandbox test agent --type developer --capabilities 'code,analyze'" \
    "pass"

run_test "Spawn denied capabilities" \
    "npx claude-flow@alpha sandbox test agent --type malicious --capabilities 'system-access,network-raw'" \
    "fail"

run_test "Agent isolation" \
    "npx claude-flow@alpha sandbox test agent --isolation process --communication restricted" \
    "pass"

# Test 6: Violation Handling
echo -e "\n${GREEN}6. Testing Violation Handling${NC}"

run_test "Low severity violation" \
    "npx claude-flow@alpha sandbox test violation --type filesystem --severity low --count 5" \
    "pass"

run_test "High severity violation escalation" \
    "npx claude-flow@alpha sandbox test violation --type network --severity high --count 10" \
    "pass"

run_test "Critical violation kill switch" \
    "npx claude-flow@alpha sandbox test violation --type resource --severity critical --count 3" \
    "pass"

# Test 7: Policy Updates
echo -e "\n${GREEN}7. Testing Dynamic Policy Updates${NC}"

run_test "Update filesystem policy" \
    "npx claude-flow@alpha sandbox policy update --filesystem --add-allowed './new-path'" \
    "pass"

run_test "Update network policy" \
    "npx claude-flow@alpha sandbox policy update --network --add-denied 'suspicious.com'" \
    "pass"

run_test "Update resource limits" \
    "npx claude-flow@alpha sandbox policy update --resources --memory 1024MB --cpu 2.0" \
    "pass"

# Test 8: Monitoring and Reporting
echo -e "\n${GREEN}8. Testing Monitoring and Reporting${NC}"

run_test "Get sandbox statistics" \
    "npx claude-flow@alpha sandbox stats --format json" \
    "pass"

run_test "Get violation report" \
    "npx claude-flow@alpha sandbox violations --last 24h --format table" \
    "pass"

run_test "Generate security report" \
    "npx claude-flow@alpha sandbox report --comprehensive --format pdf" \
    "pass"

# Cleanup
echo -e "\n${YELLOW}Cleaning up test files...${NC}"
rm -rf ./test-allowed ./test-denied

# Summary
echo -e "\n${GREEN}================================${NC}"
echo -e "${GREEN}Sandbox Test Summary${NC}"
echo -e "${GREEN}================================${NC}"
echo -e "Tests Passed: ${GREEN}${PASSED}${NC}"
echo -e "Tests Failed: ${RED}${FAILED}${NC}"

if [[ $FAILED -eq 0 ]]; then
    echo -e "\n${GREEN}🎉 All sandbox tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}❌ Some tests failed. Please review the output.${NC}"
    exit 1
fi
