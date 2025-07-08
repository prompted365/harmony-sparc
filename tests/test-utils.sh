#!/bin/bash
# Shared test utilities for Claude Flow security tests

# Colors
export GREEN='\033[0;32m'
export BLUE='\033[0;34m'
export YELLOW='\033[1;33m'
export RED='\033[0;31m'
export NC='\033[0m' # No Color

# Test counters
export PASSED=0
export FAILED=0

# Test result tracking
declare -a TEST_RESULTS

# Enhanced test function with timing
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_result="${3:-pass}"
    
    echo -e "\n${BLUE}Testing: ${test_name}${NC}"
    echo -e "${YELLOW}Command: ${test_command}${NC}"
    
    # Time the test
    local start_time=$(date +%s)
    
    # Run the test
    if eval "$test_command" > /tmp/test_output.log 2>&1; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        if [[ "$expected_result" == "pass" ]]; then
            echo -e "${GREEN}✅ PASSED (${duration}s)${NC}"
            ((PASSED++))
            TEST_RESULTS+=("PASS|$test_name|$duration")
        else
            echo -e "${RED}❌ FAILED - Expected to fail but passed${NC}"
            cat /tmp/test_output.log
            ((FAILED++))
            TEST_RESULTS+=("FAIL|$test_name|$duration|Expected failure but passed")
        fi
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        if [[ "$expected_result" == "fail" ]]; then
            echo -e "${GREEN}✅ PASSED - Failed as expected (${duration}s)${NC}"
            ((PASSED++))
            TEST_RESULTS+=("PASS|$test_name|$duration|Failed as expected")
        else
            echo -e "${RED}❌ FAILED (${duration}s)${NC}"
            echo -e "${RED}Output:${NC}"
            cat /tmp/test_output.log
            ((FAILED++))
            TEST_RESULTS+=("FAIL|$test_name|$duration")
        fi
    fi
    
    rm -f /tmp/test_output.log
}

# Assert functions
assert_equals() {
    local expected="$1"
    local actual="$2"
    local message="${3:-Assertion failed}"
    
    if [[ "$expected" != "$actual" ]]; then
        echo -e "${RED}❌ $message${NC}"
        echo -e "${RED}   Expected: $expected${NC}"
        echo -e "${RED}   Actual: $actual${NC}"
        return 1
    fi
    return 0
}

assert_contains() {
    local haystack="$1"
    local needle="$2"
    local message="${3:-String not found}"
    
    if [[ ! "$haystack" =~ "$needle" ]]; then
        echo -e "${RED}❌ $message${NC}"
        echo -e "${RED}   Looking for: $needle${NC}"
        echo -e "${RED}   In: $haystack${NC}"
        return 1
    fi
    return 0
}

assert_file_exists() {
    local file="$1"
    local message="${2:-File not found}"
    
    if [[ ! -f "$file" ]]; then
        echo -e "${RED}❌ $message: $file${NC}"
        return 1
    fi
    return 0
}

assert_json_field() {
    local json="$1"
    local field="$2"
    local expected="$3"
    local message="${4:-JSON field mismatch}"
    
    local actual=$(echo "$json" | jq -r "$field" 2>/dev/null)
    
    if [[ "$actual" != "$expected" ]]; then
        echo -e "${RED}❌ $message${NC}"
        echo -e "${RED}   Field: $field${NC}"
        echo -e "${RED}   Expected: $expected${NC}"
        echo -e "${RED}   Actual: $actual${NC}"
        return 1
    fi
    return 0
}

# Setup test environment
setup_test_env() {
    export CLAUDE_FLOW_ENV=test
    export CLAUDE_FLOW_LOG_LEVEL=debug
    export CLAUDE_FLOW_TEST_MODE=true
    
    # Create test directories
    mkdir -p test-data test-output
    
    echo -e "${YELLOW}Test environment configured${NC}"
}

# Cleanup test environment
cleanup_test_env() {
    rm -rf test-data test-output
    unset CLAUDE_FLOW_ENV
    unset CLAUDE_FLOW_LOG_LEVEL
    unset CLAUDE_FLOW_TEST_MODE
    
    echo -e "${YELLOW}Test environment cleaned up${NC}"
}

# Generate test data
generate_test_message() {
    local type="$1"
    local sender="${2:-agent-001}"
    local receivers="${3:-agent-002,agent-003}"
    
    cat << EOF
{
  "id": "msg-$(uuidgen || echo $RANDOM)",
  "type": "$type",
  "sender": {"id": "$sender"},
  "receivers": $(echo "$receivers" | awk -F, '{printf "["; for(i=1;i<=NF;i++) printf "%s{\"id\":\"%s\"}", (i>1?",":""), $i; printf "]"}'),
  "content": {
    "data": "test-data-$(date +%s)",
    "random": $RANDOM
  },
  "metadata": {
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "test": true
  }
}
EOF
}

# Wait for condition with timeout
wait_for() {
    local condition="$1"
    local timeout="${2:-30}"
    local interval="${3:-1}"
    local elapsed=0
    
    echo -e "${YELLOW}Waiting for: $condition (timeout: ${timeout}s)${NC}"
    
    while ! eval "$condition"; do
        if [[ $elapsed -ge $timeout ]]; then
            echo -e "${RED}Timeout waiting for condition${NC}"
            return 1
        fi
        sleep $interval
        elapsed=$((elapsed + interval))
        echo -n "."
    done
    
    echo -e "\n${GREEN}Condition met after ${elapsed}s${NC}"
    return 0
}

# Print test summary
print_summary() {
    echo -e "\n${GREEN}================================${NC}"
    echo -e "${GREEN}Test Summary${NC}"
    echo -e "${GREEN}================================${NC}"
    echo -e "Tests Passed: ${GREEN}${PASSED}${NC}"
    echo -e "Tests Failed: ${RED}${FAILED}${NC}"
    
    if [[ ${#TEST_RESULTS[@]} -gt 0 ]]; then
        echo -e "\n${BLUE}Detailed Results:${NC}"
        for result in "${TEST_RESULTS[@]}"; do
            IFS='|' read -r status name duration message <<< "$result"
            if [[ "$status" == "PASS" ]]; then
                echo -e "  ${GREEN}✓${NC} $name (${duration}s) ${message:+- $message}"
            else
                echo -e "  ${RED}✗${NC} $name (${duration}s) ${message:+- $message}"
            fi
        done
    fi
    
    # Calculate stats
    local total=$((PASSED + FAILED))
    if [[ $total -gt 0 ]]; then
        local pass_rate=$(echo "scale=1; ($PASSED / $total) * 100" | bc)
        echo -e "\n${BLUE}Pass Rate: ${pass_rate}%${NC}"
    fi
}

# Mock Claude Flow commands for testing
mock_claude_flow() {
    local command="$1"
    shift
    
    case "$command" in
        "sandbox")
            echo '{"status": "active", "violations": 0}'
            ;;
        "james")
            echo '{"status": "deployed", "detections": 0}'
            ;;
        "daa")
            echo '{"status": "monitoring", "patterns": []}'
            ;;
        *)
            echo '{"status": "ok"}'
            ;;
    esac
}

# Create test project structure
create_test_project() {
    local name="${1:-test-project}"
    
    mkdir -p "$name"/{src,tests,data}
    
    cat > "$name/package.json" << EOF
{
  "name": "$name",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "test": "echo 'Running tests...'"
  }
}
EOF
    
    cat > "$name/.claude/settings.json" << EOF
{
  "sandbox": {
    "enabled": true,
    "profile": "development"
  },
  "james": {
    "enabled": true,
    "density": 0.2
  }
}
EOF
    
    echo -e "${GREEN}Created test project: $name${NC}"
}

# Simulate agent activity
simulate_agent_activity() {
    local count="${1:-10}"
    local type="${2:-mixed}"
    
    echo -e "${YELLOW}Simulating $count agent messages of type: $type${NC}"
    
    for i in $(seq 1 $count); do
        local msg_type
        case "$type" in
            "p2p")
                msg_type="gossip"
                ;;
            "economic")
                msg_type="token_transfer"
                ;;
            "ml")
                msg_type="gradient_update"
                ;;
            *)
                # Random type
                local types=("gossip" "token_transfer" "gradient_update" "task_assignment")
                msg_type="${types[$((RANDOM % ${#types[@]}))]}"
                ;;
        esac
        
        generate_test_message "$msg_type" > "test-data/message-$i.json"
    done
    
    echo -e "${GREEN}Generated $count test messages${NC}"
}

# Export all functions
export -f run_test assert_equals assert_contains assert_file_exists assert_json_field
export -f setup_test_env cleanup_test_env generate_test_message wait_for print_summary
export -f mock_claude_flow create_test_project simulate_agent_activity
