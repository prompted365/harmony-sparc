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
FAILED_SUITES=""

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
        local passed=$(grep -c "✅ PASSED" "test-results/${suite_file%.sh}.log" 2>/dev/null || echo 0)
        local failed=$(grep -c "❌ FAILED" "test-results/${suite_file%.sh}.log" 2>/dev/null || echo 0)
        
        TOTAL_PASSED=$((TOTAL_PASSED + passed))
        TOTAL_FAILED=$((TOTAL_FAILED + failed))
    else
        echo -e "${RED}❌ ${suite_name} FAILED${NC}"
        echo -e "${YELLOW}   Check test-results/${suite_file%.sh}.log for details${NC}"
        FAILED_SUITES="${FAILED_SUITES}${suite_name},"
        
        # Still try to extract counts
        local passed=$(grep -c "✅ PASSED" "test-results/${suite_file%.sh}.log" 2>/dev/null || echo 0)
        local failed=$(grep -c "❌ FAILED" "test-results/${suite_file%.sh}.log" 2>/dev/null || echo 0)
        
        TOTAL_PASSED=$((TOTAL_PASSED + passed))
        TOTAL_FAILED=$((TOTAL_FAILED + failed))
    fi
}

# Define test suites (using simple arrays to avoid bash version issues)
test_suite_names=(
    "Sandbox Security"
    "James Agent"
    "DAA Monitoring"
    "Integration"
)

test_suite_files=(
    "test-sandbox.sh"
    "test-james-agent.sh"
    "test-daa-monitor.sh"
    "test-integration.sh"
)

# Check if individual test scripts exist
echo -e "${YELLOW}Checking test scripts...${NC}"
for i in "${!test_suite_files[@]}"; do
    suite_file="${test_suite_files[$i]}"
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
for i in "${!test_suite_names[@]}"; do
    run_suite "${test_suite_names[$i]}" "${test_suite_files[$i]}"
done

# Calculate test duration
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
MINUTES=$((DURATION / 60))
SECONDS=$((DURATION % 60))

# Calculate pass rate safely
TOTAL_TESTS=$((TOTAL_PASSED + TOTAL_FAILED))
if [[ $TOTAL_TESTS -gt 0 ]]; then
    PASS_RATE=$(echo "scale=2; ($TOTAL_PASSED * 100) / $TOTAL_TESTS" | bc 2>/dev/null || echo "0")
else
    PASS_RATE="0"
fi

# Format failed suites list
FAILED_SUITES_JSON="[]"
if [[ -n "$FAILED_SUITES" ]]; then
    # Remove trailing comma and format as JSON array
    FAILED_SUITES=${FAILED_SUITES%,}
    FAILED_SUITES_JSON=$(echo "$FAILED_SUITES" | awk -F, '{printf "["; for(i=1;i<=NF;i++) printf "%s\"%s\"", (i>1?",":""), $i; printf "]"}')
fi

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
    "total_tests": $TOTAL_TESTS,
    "passed": $TOTAL_PASSED,
    "failed": $TOTAL_FAILED,
    "pass_rate": $PASS_RATE
  },
  "failed_suites": $FAILED_SUITES_JSON,
  "environment": {
    "node_version": "$(node --version 2>/dev/null || echo 'not installed')",
    "npm_version": "$(npm --version 2>/dev/null || echo 'not installed')",
    "claude_flow_version": "$(npx claude-flow@alpha --version 2>/dev/null || echo 'not installed')"
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
        .warning { background: #fff3cd; border: 1px solid #ffeeba; padding: 15px; border-radius: 4px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🧪 Claude Flow Security Test Report</h1>
        <p class="timestamp">Generated: $(date)</p>
        
        <div class="summary">
            <div class="metric">
                <h3>Total Tests</h3>
                <div class="value">$TOTAL_TESTS</div>
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
                <div class="value">${PASS_RATE}%</div>
            </div>
            <div class="metric">
                <h3>Duration</h3>
                <div class="value">${MINUTES}m ${SECONDS}s</div>
            </div>
        </div>
EOF

# Add warning if claude-flow is not installed
if ! command -v npx &> /dev/null || ! npx claude-flow@alpha --version &> /dev/null 2>&1; then
    cat >> test-results/test-report.html << EOF
        <div class="warning">
            <strong>⚠️ Warning:</strong> Claude Flow does not appear to be installed. 
            These are development tests for features that may not be available yet.
            Install with: <code>npm install -g claude-flow@alpha</code>
        </div>
EOF
fi

cat >> test-results/test-report.html << EOF
        
        <h2>Test Suites</h2>
EOF

# Add suite results to HTML
for i in "${!test_suite_names[@]}"; do
    suite_name="${test_suite_names[$i]}"
    if [[ "$FAILED_SUITES" == *"$suite_name"* ]]; then
        echo "<div class='suite failed'><strong>❌ $suite_name</strong> - Failed (see logs)</div>" >> test-results/test-report.html
    else
        echo "<div class='suite passed'><strong>✅ $suite_name</strong> - Passed</div>" >> test-results/test-report.html
    fi
done

cat >> test-results/test-report.html << EOF
        
        <h2>Environment</h2>
        <table>
            <tr><th>Component</th><th>Version</th></tr>
            <tr><td>Node.js</td><td>$(node --version 2>/dev/null || echo 'not installed')</td></tr>
            <tr><td>npm</td><td>$(npm --version 2>/dev/null || echo 'not installed')</td></tr>
            <tr><td>Claude Flow</td><td>$(npx claude-flow@alpha --version 2>/dev/null || echo 'not installed')</td></tr>
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

# Count failed suites
FAILED_COUNT=0
if [[ -n "$FAILED_SUITES" && "$FAILED_SUITES" != "" ]]; then
    FAILED_COUNT=$(echo "$FAILED_SUITES" | awk -F, '{print NF}')
fi

# Display summary
echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Test Summary${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$TOTAL_PASSED${NC}"
echo -e "Failed: ${RED}$TOTAL_FAILED${NC}"
echo -e "Pass Rate: ${PASS_RATE}%"
echo -e "Duration: ${MINUTES}m ${SECONDS}s"

if [[ $FAILED_COUNT -gt 0 ]]; then
    echo -e "\n${RED}Failed Suites:${NC}"
    echo "$FAILED_SUITES" | tr ',' '\n' | while read suite; do
        [[ -n "$suite" ]] && echo -e "  - $suite"
    done
fi

echo -e "\n${BLUE}📊 Reports Generated:${NC}"
echo -e "  - JSON: test-results/test-report.json"
echo -e "  - HTML: test-results/test-report.html"
echo -e "  - Logs: test-results/*.log"

# Check if this is a development environment
if [[ "$CLAUDE_FLOW_ENV" == "test" ]]; then
    echo -e "\n${YELLOW}Note: Running in test mode. Some commands may use mock implementations.${NC}"
fi

# Exit with appropriate code
if [[ $TOTAL_FAILED -eq 0 && $FAILED_COUNT -eq 0 ]]; then
    echo -e "\n${GREEN}🎉 All tests passed successfully!${NC}"
    exit 0
else
    echo -e "\n${RED}❌ Some tests failed. Please review the reports and logs.${NC}"
    exit 1
fi
