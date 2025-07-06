#!/bin/bash

# AgentFlow API Database Services Startup Script
# This script manages PostgreSQL and Redis services for local development

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.production.yml"
ENV_FILE=".env.production"
PROJECT_NAME="agentflow"

# Functions
print_header() {
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}     AgentFlow Database Services Manager${NC}"
    echo -e "${BLUE}================================================${NC}"
}

check_dependencies() {
    echo -e "${YELLOW}Checking dependencies...${NC}"
    
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Error: Docker is not installed${NC}"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        echo -e "${RED}Error: Docker Compose is not installed${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ All dependencies are installed${NC}"
}

check_ports() {
    echo -e "${YELLOW}Checking port availability...${NC}"
    
    local ports=("5433:PostgreSQL" "6380:Redis" "5050:pgAdmin" "8081:Redis Commander")
    local ports_in_use=()
    
    for port_info in "${ports[@]}"; do
        IFS=':' read -r port service <<< "$port_info"
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            ports_in_use+=("$port ($service)")
        fi
    done
    
    if [ ${#ports_in_use[@]} -ne 0 ]; then
        echo -e "${RED}Error: The following ports are already in use:${NC}"
        printf '%s\n' "${ports_in_use[@]}"
        echo -e "${YELLOW}Please stop the services using these ports or change the port mappings${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✓ All required ports are available${NC}"
}

setup_environment() {
    if [ ! -f "$ENV_FILE" ]; then
        echo -e "${YELLOW}Creating environment file from template...${NC}"
        if [ -f ".env.production" ]; then
            cp .env.production .env
            echo -e "${GREEN}✓ Environment file created${NC}"
            echo -e "${YELLOW}Please update .env with your actual passwords${NC}"
        else
            echo -e "${RED}Error: .env.production template not found${NC}"
            exit 1
        fi
    fi
}

start_services() {
    echo -e "${YELLOW}Starting database services...${NC}"
    
    # Use docker compose v2 if available, otherwise fall back to docker-compose
    if docker compose version &> /dev/null; then
        docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" up -d
    else
        docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" up -d
    fi
    
    echo -e "${GREEN}✓ Services started${NC}"
}

wait_for_services() {
    echo -e "${YELLOW}Waiting for services to be healthy...${NC}"
    
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" ps | grep -q "healthy"; then
            echo -e "${GREEN}✓ All services are healthy${NC}"
            return 0
        fi
        
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}Error: Services failed to become healthy${NC}"
    return 1
}

show_connection_info() {
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}          Connection Information${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo
    echo -e "${GREEN}PostgreSQL:${NC}"
    echo "  Host: localhost"
    echo "  Port: 5433"
    echo "  Database: agentflow"
    echo "  Username: agentflow_user"
    echo "  Password: (see DB_PASSWORD in .env)"
    echo "  Connection: postgresql://agentflow_user:password@localhost:5433/agentflow"
    echo
    echo -e "${GREEN}Redis:${NC}"
    echo "  Host: localhost"
    echo "  Port: 6380"
    echo "  Password: (see REDIS_PASSWORD in .env)"
    echo "  Connection: redis://:password@localhost:6380/0"
    echo
    echo -e "${GREEN}Admin UIs (optional - use --with-admin flag):${NC}"
    echo "  pgAdmin: http://localhost:5050"
    echo "  Redis Commander: http://localhost:8081"
    echo
}

stop_services() {
    echo -e "${YELLOW}Stopping database services...${NC}"
    
    if docker compose version &> /dev/null; then
        docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down
    else
        docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down
    fi
    
    echo -e "${GREEN}✓ Services stopped${NC}"
}

status_services() {
    echo -e "${YELLOW}Service status:${NC}"
    
    if docker compose version &> /dev/null; then
        docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" ps
    else
        docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" ps
    fi
}

# Main script
case "${1:-start}" in
    start)
        print_header
        check_dependencies
        check_ports || exit 1
        setup_environment
        
        if [[ "${2:-}" == "--with-admin" ]]; then
            export COMPOSE_PROFILES="admin"
        fi
        
        start_services
        wait_for_services
        show_connection_info
        ;;
    stop)
        print_header
        stop_services
        ;;
    restart)
        print_header
        stop_services
        sleep 2
        check_ports || exit 1
        start_services
        wait_for_services
        show_connection_info
        ;;
    status)
        print_header
        status_services
        ;;
    logs)
        if docker compose version &> /dev/null; then
            docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" logs -f ${2:-}
        else
            docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" logs -f ${2:-}
        fi
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs} [options]"
        echo "Options:"
        echo "  start --with-admin  Start with admin UIs (pgAdmin and Redis Commander)"
        echo "  logs [service]      Show logs for all services or specific service"
        exit 1
        ;;
esac