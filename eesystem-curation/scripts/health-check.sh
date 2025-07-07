#!/bin/bash

# Health Check Script for EESystem Content Curation Platform
# This script performs comprehensive health checks for Railway deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL=${BACKEND_URL:-"https://api.eesystem-curation.railway.app"}
FRONTEND_URL=${FRONTEND_URL:-"https://eesystem-curation.railway.app"}
TIMEOUT=${TIMEOUT:-30}
VERBOSE=${VERBOSE:-false}

echo -e "${GREEN}🏥 EESystem Health Check${NC}"
echo -e "${GREEN}========================${NC}"

# Function to check HTTP endpoint
check_endpoint() {
    local url=$1
    local description=$2
    local expected_status=${3:-200}
    local timeout=${4:-$TIMEOUT}
    
    if [ "$VERBOSE" = true ]; then
        echo -e "${BLUE}Checking: $description${NC}"
        echo -e "${BLUE}URL: $url${NC}"
    fi
    
    response=$(curl -s -w "%{http_code}|%{time_total}|%{size_download}" \
                   --max-time $timeout \
                   --connect-timeout 10 \
                   -H "User-Agent: EESystem-HealthCheck/1.0" \
                   "$url" 2>/dev/null || echo "000|0|0")
    
    IFS='|' read -r status_code response_time size <<< "$response"
    
    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}✅ $description${NC}"
        if [ "$VERBOSE" = true ]; then
            echo -e "   Status: $status_code | Time: ${response_time}s | Size: ${size}B"
        fi
        return 0
    else
        echo -e "${RED}❌ $description${NC}"
        echo -e "   Expected: $expected_status | Got: $status_code | Time: ${response_time}s"
        return 1
    fi
}

# Function to check JSON response
check_json_endpoint() {
    local url=$1
    local description=$2
    local timeout=${3:-$TIMEOUT}
    
    if [ "$VERBOSE" = true ]; then
        echo -e "${BLUE}Checking JSON: $description${NC}"
        echo -e "${BLUE}URL: $url${NC}"
    fi
    
    response=$(curl -s --max-time $timeout \
                   --connect-timeout 10 \
                   -H "Accept: application/json" \
                   -H "User-Agent: EESystem-HealthCheck/1.0" \
                   "$url" 2>/dev/null)
    
    if [ $? -eq 0 ] && echo "$response" | python3 -m json.tool >/dev/null 2>&1; then
        status=$(echo "$response" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('status', 'unknown'))" 2>/dev/null)
        
        if [ "$status" = "healthy" ] || [ "$status" = "ready" ] || [ "$status" = "alive" ]; then
            echo -e "${GREEN}✅ $description${NC}"
            if [ "$VERBOSE" = true ]; then
                echo -e "   Status: $status"
                echo "$response" | python3 -m json.tool | head -10
            fi
            return 0
        else
            echo -e "${RED}❌ $description${NC}"
            echo -e "   Status: $status"
            return 1
        fi
    else
        echo -e "${RED}❌ $description${NC}"
        echo -e "   Invalid JSON response or connection failed"
        return 1
    fi
}

# Function to check WebSocket
check_websocket() {
    local url=$1
    local description=$2
    
    if command -v wscat >/dev/null 2>&1; then
        echo -e "${BLUE}Checking WebSocket: $description${NC}"
        
        # Test WebSocket connection
        timeout 10 wscat -c "$url" -x 'ping' >/dev/null 2>&1
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ $description${NC}"
            return 0
        else
            echo -e "${RED}❌ $description${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}⚠️  WebSocket check skipped (wscat not installed)${NC}"
        return 0
    fi
}

# Function to check performance
check_performance() {
    local url=$1
    local description=$2
    local max_time=${3:-2.0}
    
    if [ "$VERBOSE" = true ]; then
        echo -e "${BLUE}Performance check: $description${NC}"
    fi
    
    response_time=$(curl -s -w "%{time_total}" --max-time 30 -o /dev/null "$url" 2>/dev/null || echo "999")
    
    if (( $(echo "$response_time < $max_time" | bc -l) )); then
        echo -e "${GREEN}✅ $description (${response_time}s)${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  $description slow (${response_time}s > ${max_time}s)${NC}"
        return 1
    fi
}

# Main health check function
main() {
    local exit_code=0
    
    echo -e "${BLUE}🔍 Basic Connectivity${NC}"
    echo "----------------------------------------"
    
    # Basic endpoint checks
    check_endpoint "$FRONTEND_URL" "Frontend availability" 200 || exit_code=1
    check_endpoint "$BACKEND_URL/health" "Backend health endpoint" 200 || exit_code=1
    
    echo ""
    echo -e "${BLUE}🔬 Detailed Health Checks${NC}"
    echo "----------------------------------------"
    
    # JSON health checks
    check_json_endpoint "$BACKEND_URL/health" "Backend basic health" || exit_code=1
    check_json_endpoint "$BACKEND_URL/health/detailed" "Backend detailed health" || exit_code=1
    check_json_endpoint "$BACKEND_URL/health/ready" "Backend readiness" || exit_code=1
    check_json_endpoint "$BACKEND_URL/health/live" "Backend liveness" || exit_code=1
    
    echo ""
    echo -e "${BLUE}🚀 API Endpoints${NC}"
    echo "----------------------------------------"
    
    # API endpoint checks
    check_endpoint "$BACKEND_URL/api/docs" "API documentation" 200 || exit_code=1
    check_endpoint "$BACKEND_URL/api/openapi.json" "OpenAPI schema" 200 || exit_code=1
    
    echo ""
    echo -e "${BLUE}⚡ Performance Tests${NC}"
    echo "----------------------------------------"
    
    # Performance checks
    check_performance "$BACKEND_URL/health" "Backend response time" 1.0 || exit_code=1
    check_performance "$FRONTEND_URL" "Frontend load time" 3.0 || exit_code=1
    
    echo ""
    echo -e "${BLUE}🔌 Connectivity Tests${NC}"
    echo "----------------------------------------"
    
    # WebSocket check (if available)
    ws_url=$(echo "$BACKEND_URL" | sed 's/^https:/wss:/' | sed 's/^http:/ws:/')
    check_websocket "$ws_url/ws" "WebSocket connection"
    
    echo ""
    echo -e "${BLUE}📊 System Status${NC}"
    echo "----------------------------------------"
    
    # Check system metrics endpoint
    if check_endpoint "$BACKEND_URL/metrics" "Metrics endpoint" 200; then
        if [ "$VERBOSE" = true ]; then
            echo -e "${BLUE}Sample metrics:${NC}"
            curl -s "$BACKEND_URL/metrics" | head -10
        fi
    fi
    
    echo ""
    echo -e "${BLUE}📋 Summary${NC}"
    echo "----------------------------------------"
    
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}🎉 All health checks passed!${NC}"
        echo -e "${GREEN}✅ System is healthy and operational${NC}"
    else
        echo -e "${RED}⚠️  Some health checks failed${NC}"
        echo -e "${RED}❌ Please review the issues above${NC}"
    fi
    
    echo ""
    echo -e "${BLUE}🔗 Useful Links${NC}"
    echo "Frontend: $FRONTEND_URL"
    echo "Backend API: $BACKEND_URL"
    echo "API Docs: $BACKEND_URL/api/docs"
    echo "Health Check: $BACKEND_URL/health/detailed"
    
    return $exit_code
}

# Function to run continuous monitoring
monitor() {
    local interval=${1:-60}
    local count=${2:-0}
    
    echo -e "${GREEN}🔄 Starting continuous monitoring (interval: ${interval}s)${NC}"
    echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
    echo ""
    
    local iteration=0
    
    while [ $count -eq 0 ] || [ $iteration -lt $count ]; do
        iteration=$((iteration + 1))
        echo -e "${BLUE}--- Iteration $iteration $(date) ---${NC}"
        
        main
        local health_status=$?
        
        if [ $health_status -eq 0 ]; then
            echo -e "${GREEN}✅ Healthy${NC}"
        else
            echo -e "${RED}❌ Unhealthy${NC}"
            
            # Optional: Send alert
            if [ ! -z "$ALERT_WEBHOOK" ]; then
                curl -s -X POST "$ALERT_WEBHOOK" \
                     -H "Content-Type: application/json" \
                     -d "{\"text\": \"EESystem health check failed at $(date)\"}" \
                     >/dev/null 2>&1
            fi
        fi
        
        echo ""
        sleep $interval
    done
}

# Function to check specific component
check_component() {
    local component=$1
    
    case $component in
        "backend")
            check_json_endpoint "$BACKEND_URL/health/detailed" "Backend detailed health"
            ;;
        "frontend")
            check_endpoint "$FRONTEND_URL" "Frontend availability"
            ;;
        "api")
            check_endpoint "$BACKEND_URL/api/docs" "API documentation"
            ;;
        "database")
            check_json_endpoint "$BACKEND_URL/health/detailed" "Database health"
            ;;
        "redis")
            check_json_endpoint "$BACKEND_URL/health/detailed" "Redis health"
            ;;
        *)
            echo -e "${RED}Unknown component: $component${NC}"
            echo -e "${YELLOW}Available: backend, frontend, api, database, redis${NC}"
            exit 1
            ;;
    esac
}

# Handle command line arguments
case "${1:-}" in
    "monitor")
        monitor ${2:-60} ${3:-0}
        ;;
    "component")
        check_component ${2:-backend}
        ;;
    "quick")
        TIMEOUT=5
        check_endpoint "$BACKEND_URL/health" "Quick backend check"
        ;;
    "verbose")
        VERBOSE=true
        main
        ;;
    "help"|"-h"|"--help")
        echo "Usage: $0 [command] [options]"
        echo ""
        echo "Commands:"
        echo "  (default)          Run all health checks"
        echo "  monitor [interval] Start continuous monitoring"
        echo "  component [name]   Check specific component"
        echo "  quick             Quick health check"
        echo "  verbose           Verbose output"
        echo "  help              Show this help"
        echo ""
        echo "Environment variables:"
        echo "  BACKEND_URL       Backend API URL"
        echo "  FRONTEND_URL      Frontend URL"
        echo "  TIMEOUT           Request timeout (seconds)"
        echo "  VERBOSE           Enable verbose output"
        echo "  ALERT_WEBHOOK     Webhook for alerts"
        exit 0
        ;;
    "")
        main
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        echo -e "${YELLOW}Use '$0 help' for usage information${NC}"
        exit 1
        ;;
esac