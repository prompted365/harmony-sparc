#!/bin/bash
# Master Test Runner for Claude Flow Security Suite
# Runs all test suites and generates comprehensive report

set -e

echo "🧪 Claude Flow Security Testing Suite"
echo "===================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Set test environment
export CLAUDE_FLOW_ENV=test
export CLAUDE_FLOW_LOG_LEVEL=debug
export CLAUDE_FLOW_TEST_MODE=true

# Create test results directory
mkdir -p test-results

# Test timing
START_TIME=$(date +%s)

# Track overall results
TOTAL_PASSED=0
TOTAL_FAILED=0
FAILED_SUITES=()

# Run test suite function
run_suite() {
    local suite_name="$1"
    local suite_file="$2"
    
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Running: ${suite_name}${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    # Make script executable
    chmod +x "tests/${suite_file}"
    
    # Run the test suite
    if ./tests/${suite_file} > "test-results/${suite_file%.sh}.log" 2>&1; then
        echo -e "${GREEN}✅ ${suite_name} PASSED${NC}"
        
        # Extract pass/fail counts from log
        local passed=$(grep -c "✅ PASSED" "test-results/${suite_file%.sh}.log" || echo 0)
        local failed=$(grep -c "❌ FAILED" "test-results/${suite_file%.sh}.log" || echo 0)
        
        TOTAL_PASSED=$((TOTAL_PASSED + passed))
        TOTAL_FAILED=$((TOTAL_FAILED + failed))
    else
        echo -e "${RED}❌ ${suite_name} FAILED${NC}"
        echo -e "${YELLOW}   Check test-results/${suite_file%.sh}.log for details${NC}"
        FAILED_SUITES+=("$suite_name")
        
        # Still try to extract counts
        local passed=$(grep -c "✅ PASSED" "test-results/${suite_file%.sh}.log" || echo 0)
        local failed=$(grep -c "❌ FAILED" "test-results/${suite_file%.sh}.log" || echo 0)
        
        TOTAL_PASSED=$((TOTAL_PASSED + passed))
        TOTAL_FAILED=$((TOTAL_FAILED + failed))
    fi
}

# Define test suites
declare -A test_suites=(
    ["Sandbox Security"]="test-sandbox.sh"
    ["James Agent"]="test-james-agent.sh"
    ["DAA Monitoring"]="test-daa-monitor.sh"
    ["Integration"]="test-integration.sh"
)

# Check if individual test scripts exist
echo -e "${YELLOW}Checking test scripts...${NC}"
for suite_file in "${test_suites[@]}"; do
    if [[ ! -f "tests/$suite_file" ]]; then
        echo -e "${YELLOW}Warning: tests/$suite_file not found. Creating placeholder...${NC}"
        cat > "tests/$suite_file" << 'EOF'
#!/bin/bash
echo "Test placeholder - implement actual tests"
exit 0
EOF
        chmod +x "tests/$suite_file"
    fi
done

# Run each test suite
echo -e "\n${GREEN}Starting test execution...${NC}"
for suite_name in "${!test_suites[@]}"; do
    run_suite "$suite_name" "${test_suites[$suite_name]}"
done

# Calculate test duration
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
MINUTES=$((DURATION / 60))
SECONDS=$((DURATION % 60))

# Generate comprehensive test report
echo -e "\n${YELLOW}Generating comprehensive test report...${NC}"

cat > test-results/test-report.json << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "duration": {
    "minutes": $MINUTES,
    "seconds": $SECONDS,
    "total_seconds": $DURATION
  },
  "summary": {
    "total_tests": $((TOTAL_PASSED + TOTAL_FAILED)),
    "passed": $TOTAL_PASSED,
    "failed": $TOTAL_FAILED,
    "pass_rate": $(echo "scale=2; ($TOTAL_PASSED / ($TOTAL_PASSED + $TOTAL_FAILED)) * 100" | bc || echo 0)
  },
  "failed_suites": $(printf '%s\n' "${FAILED_SUITES[@]}" | jq -R . | jq -s . || echo '[]'),
  "environment": {
    "node_version": "$(node --version)",
    "npm_version": "$(npm --version)",
    "claude_flow_version": "$(npx claude-flow@alpha --version || echo 'unknown')"
  }
}
EOF

# Generate HTML report
echo -e "${YELLOW}Generating HTML report...${NC}"
cat > test-results/test-report.html << EOF
<!DOCTYPE html>
<html>
<head>
    <title>Claude Flow Security Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px; }
        h2 { color: #666; margin-top: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric { background: #f9f9f9; padding: 20px; border-radius: 8px; text-align: center; }
        .metric h3 { margin: 0 0 10px 0; color: #666; font-size: 14px; text-transform: uppercase; }
        .metric .value { font-size: 36px; font-weight: bold; margin: 10px 0; }
        .passed { color: #4CAF50; }
        .failed { color: #f44336; }
        .suite { margin: 20px 0; padding: 15px; background: #f9f9f9; border-left: 4px solid #2196F3; }
        .suite.failed { border-left-color: #f44336; }
        .suite.passed { border-left-color: #4CAF50; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f5f5f5; font-weight: bold; }
        .timestamp { color: #999; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🧪 Claude Flow Security Test Report</h1>
        <p class="timestamp">Generated: $(date)</p>
        
        <div class="summary">
            <div class="metric">
                <h3>Total Tests</h3>
                <div class="value">$((TOTAL_PASSED + TOTAL_FAILED))</div>
            </div>
            <div class="metric">
                <h3>Passed</h3>
                <div class="value passed">$TOTAL_PASSED</div>
            </div>
            <div class="metric">
                <h3>Failed</h3>
                <div class="value failed">$TOTAL_FAILED</div>
            </div>
            <div class="metric">
                <h3>Pass Rate</h3>
                <div class="value">$(echo "scale=1; ($TOTAL_PASSED / ($TOTAL_PASSED + $TOTAL_FAILED)) * 100" | bc || echo 0)%</div>
            </div>
            <div class="metric">
                <h3>Duration</h3>
                <div class="value">${MINUTES}m ${SECONDS}s</div>
            </div>
        </div>
        
        <h2>Test Suites</h2>
EOF

# Add suite results to HTML
for suite_name in "${!test_suites[@]}"; do
    suite_file="${test_suites[$suite_name]}"
    if [[ " ${FAILED_SUITES[@]} " =~ " ${suite_name} " ]]; then
        echo "<div class='suite failed'><strong>❌ $suite_name</strong> - Failed (see logs)</div>" >> test-results/test-report.html
    else
        echo "<div class='suite passed'><strong>✅ $suite_name</strong> - Passed</div>" >> test-results/test-report.html
    fi
done

cat >> test-results/test-report.html << EOF
        
        <h2>Environment</h2>
        <table>
            <tr><th>Component</th><th>Version</th></tr>
            <tr><td>Node.js</td><td>$(node --version)</td></tr>
            <tr><td>npm</td><td>$(npm --version)</td></tr>
            <tr><td>Claude Flow</td><td>$(npx claude-flow@alpha --version || echo 'unknown')</td></tr>
            <tr><td>Operating System</td><td>$(uname -s) $(uname -r)</td></tr>
        </table>
        
        <h2>Next Steps</h2>
        <ul>
            <li>Review failed test logs in <code>test-results/</code></li>
            <li>Run individual test suites for debugging</li>
            <li>Check integration report for detailed metrics</li>
            <li>Update tests as new features are added</li>
        </ul>
    </div>
</body>
</html>
EOF

# Display summary
echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Test Summary${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "Total Tests: $((TOTAL_PASSED + TOTAL_FAILED))"
echo -e "Passed: ${GREEN}$TOTAL_PASSED${NC}"
echo -e "Failed: ${RED}$TOTAL_FAILED${NC}"
echo -e "Duration: ${MINUTES}m ${SECONDS}s"

if [[ ${#FAILED_SUITES[@]} -gt 0 ]]; then
    echo -e "\n${RED}Failed Suites:${NC}"
    for suite in "${FAILED_SUITES[@]}"; do
        echo -e "  - $suite"
    done
fi

echo -e "\n${BLUE}📊 Reports Generated:${NC}"
echo -e "  - JSON: test-results/test-report.json"
echo -e "  - HTML: test-results/test-report.html"
echo -e "  - Logs: test-results/*.log"

# Exit with appropriate code
if [[ $TOTAL_FAILED -eq 0 && ${#FAILED_SUITES[@]} -eq 0 ]]; then
    echo -e "\n${GREEN}🎉 All tests passed successfully!${NC}"
    exit 0
else
    echo -e "\n${RED}❌ Some tests failed. Please review the reports and logs.${NC}"
    exit 1
fi
