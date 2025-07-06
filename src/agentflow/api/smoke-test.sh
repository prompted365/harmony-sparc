#!/bin/bash

# Smoke test for AgentFlow API

echo "=== AgentFlow API Smoke Test ==="
echo "================================"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0

# Test function
test_endpoint() {
    local endpoint=$1
    local expected_status=$2
    local description=$3
    
    response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000$endpoint)
    
    if [ "$response" -eq "$expected_status" ]; then
        echo -e "${GREEN}✓${NC} $description (Status: $response)"
        ((PASS_COUNT++))
    else
        echo -e "${RED}✗${NC} $description (Expected: $expected_status, Got: $response)"
        ((FAIL_COUNT++))
    fi
}

# Test response time
test_response_time() {
    local endpoint=$1
    local max_time=$2
    local description=$3
    
    response_time=$(curl -s -o /dev/null -w "%{time_total}" http://localhost:3000$endpoint)
    response_ms=$(echo "$response_time * 1000" | bc)
    
    if (( $(echo "$response_ms < $max_time" | bc -l) )); then
        echo -e "${GREEN}✓${NC} $description (${response_ms}ms < ${max_time}ms)"
        ((PASS_COUNT++))
    else
        echo -e "${RED}✗${NC} $description (${response_ms}ms > ${max_time}ms)"
        ((FAIL_COUNT++))
    fi
}

echo -e "\n1. Testing Health Endpoints:"
test_endpoint "/health" 200 "Basic health check"
test_endpoint "/health/live" 200 "Liveness probe"
test_endpoint "/health/ready" 200 "Readiness probe"
test_endpoint "/health/detailed" 200 "Detailed health"

echo -e "\n2. Testing Response Times (<100ms requirement):"
test_response_time "/health" 100 "Health endpoint response time"
test_response_time "/health/live" 100 "Liveness probe response time"

echo -e "\n3. Testing Error Handling:"
test_endpoint "/non-existent-route" 404 "404 error handling"

echo -e "\n4. Testing Database Connection:"
DB_STATUS=$(PGPASSWORD=supersecret123 psql -h localhost -p 5433 -U agentflow_user -d agentflow -t -c "SELECT status FROM agentflow.health_check();" 2>/dev/null | xargs)
if [ "$DB_STATUS" = "healthy" ]; then
    echo -e "${GREEN}✓${NC} Database connection healthy"
    ((PASS_COUNT++))
else
    echo -e "${RED}✗${NC} Database connection issue: $DB_STATUS"
    ((FAIL_COUNT++))
fi

echo -e "\n5. Testing Redis Connection:"
REDIS_PING=$(redis-cli -h localhost -p 6380 -a redissecret123 ping 2>&1 | grep -o "PONG" | head -1)
if [ "$REDIS_PING" = "PONG" ]; then
    echo -e "${GREEN}✓${NC} Redis connection healthy"
    ((PASS_COUNT++))
else
    echo -e "${RED}✗${NC} Redis connection issue"
    ((FAIL_COUNT++))
fi

echo -e "\n6. Testing API Process:"
if pgrep -f "node.*server.js" > /dev/null; then
    echo -e "${GREEN}✓${NC} API server process is running"
    ((PASS_COUNT++))
else
    echo -e "${RED}✗${NC} API server process not found"
    ((FAIL_COUNT++))
fi

echo -e "\n================================"
echo "Results: $PASS_COUNT passed, $FAIL_COUNT failed"

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
fi