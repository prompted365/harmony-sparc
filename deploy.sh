#!/bin/bash

# Harmony SPARC Production Deployment Script
# This script handles the complete deployment of the Harmony SPARC platform

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="harmony-sparc"
DOCKER_COMPOSE_FILE="docker-compose.production.yml"
DOCKERFILE="Dockerfile.production"
ENV_FILE=".env.production"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    local missing_commands=()
    
    if ! command_exists docker; then
        missing_commands+=("docker")
    fi
    
    if ! command_exists docker-compose; then
        missing_commands+=("docker-compose")
    fi
    
    if ! command_exists node; then
        missing_commands+=("node")
    fi
    
    if ! command_exists npm; then
        missing_commands+=("npm")
    fi
    
    if [ ${#missing_commands[@]} -ne 0 ]; then
        print_error "Missing required commands: ${missing_commands[*]}"
        print_error "Please install the missing commands and try again."
        exit 1
    fi
    
    # Check Docker daemon
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker daemon is not running. Please start Docker and try again."
        exit 1
    fi
    
    print_success "All prerequisites satisfied"
}

# Function to validate environment file
validate_environment() {
    print_status "Validating environment configuration..."
    
    if [ ! -f "$ENV_FILE" ]; then
        print_warning "Environment file $ENV_FILE not found. Creating from example..."
        if [ -f ".env.example" ]; then
            cp .env.example "$ENV_FILE"
            print_warning "Please edit $ENV_FILE with your production values before continuing."
            exit 1
        else
            print_error "No environment example file found."
            exit 1
        fi
    fi
    
    # Check for required environment variables
    local required_vars=(
        "POSTGRES_PASSWORD"
        "REDIS_PASSWORD"
        "JWT_SECRET"
        "BLOCKCHAIN_RPC_URL"
    )
    
    local missing_vars=()
    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" "$ENV_FILE" || grep -q "^${var}=your_" "$ENV_FILE"; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        print_error "Missing or placeholder values for required environment variables:"
        printf '%s\n' "${missing_vars[@]}"
        print_error "Please update $ENV_FILE with real values."
        exit 1
    fi
    
    print_success "Environment configuration validated"
}

# Function to create necessary directories
create_directories() {
    print_status "Creating necessary directories..."
    
    local directories=(
        "logs"
        "uploads"
        "ssl"
        "database/backups"
        "monitoring/grafana/dashboards"
        "monitoring/grafana/provisioning/datasources"
        "monitoring/grafana/provisioning/dashboards"
    )
    
    for dir in "${directories[@]}"; do
        mkdir -p "$dir"
        print_status "Created directory: $dir"
    done
    
    # Set proper permissions
    chmod 755 logs uploads
    chmod 700 ssl
    
    print_success "Directories created successfully"
}

# Function to generate SSL certificates (self-signed for development)
generate_ssl_certificates() {
    print_status "Checking SSL certificates..."
    
    if [ ! -f "ssl/harmony-sparc.crt" ] || [ ! -f "ssl/harmony-sparc.key" ]; then
        print_warning "SSL certificates not found. Generating self-signed certificates..."
        
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout ssl/harmony-sparc.key \
            -out ssl/harmony-sparc.crt \
            -subj "/C=US/ST=State/L=City/O=Organization/CN=harmony-sparc.local" \
            2>/dev/null
        
        chmod 600 ssl/harmony-sparc.key
        chmod 644 ssl/harmony-sparc.crt
        
        print_warning "Self-signed certificates generated. Replace with real certificates for production."
    else
        print_success "SSL certificates found"
    fi
}

# Function to build Docker images
build_images() {
    print_status "Building Docker images..."
    
    # Build the main application image
    docker build -f "$DOCKERFILE" -t "${PROJECT_NAME}:production" .
    
    print_success "Docker images built successfully"
}

# Function to run database migrations
run_migrations() {
    print_status "Running database migrations..."
    
    # Start just the database for migrations
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d postgres
    
    # Wait for database to be ready
    print_status "Waiting for database to be ready..."
    sleep 30
    
    # Run migrations (if you have them)
    # docker-compose -f "$DOCKER_COMPOSE_FILE" exec postgres psql -U postgres -d harmony_db -f /docker-entrypoint-initdb.d/01-init.sql
    
    print_success "Database migrations completed"
}

# Function to deploy smart contracts
deploy_contracts() {
    print_status "Deploying smart contracts..."
    
    # Start blockchain node
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d blockchain-node
    
    # Wait for blockchain to be ready
    print_status "Waiting for blockchain node to be ready..."
    sleep 20
    
    # Deploy contracts
    if [ -f "hardhat.config.js" ]; then
        npm run hardhat:compile
        # npm run hardhat:deploy
        print_success "Smart contracts deployed"
    else
        print_warning "No hardhat configuration found, skipping contract deployment"
    fi
}

# Function to start all services
start_services() {
    print_status "Starting all services..."
    
    # Start all services
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d
    
    # Wait for services to be ready
    print_status "Waiting for services to be ready..."
    sleep 60
    
    print_success "All services started"
}

# Function to run health checks
run_health_checks() {
    print_status "Running health checks..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T harmony-api node healthcheck.js; then
            print_success "Health checks passed"
            return 0
        fi
        
        print_status "Health check attempt $attempt/$max_attempts failed, retrying in 10 seconds..."
        sleep 10
        ((attempt++))
    done
    
    print_error "Health checks failed after $max_attempts attempts"
    return 1
}

# Function to show deployment status
show_status() {
    print_status "Deployment Status:"
    echo ""
    
    docker-compose -f "$DOCKER_COMPOSE_FILE" ps
    
    echo ""
    print_status "Service URLs:"
    echo "• Main API: https://localhost"
    echo "• API v1: https://localhost/api/v1"
    echo "• Health Check: https://localhost/health"
    echo "• Grafana: http://localhost:3003"
    echo "• Kibana: http://localhost:5601"
    echo "• Prometheus: http://localhost:9090"
    echo ""
    
    print_success "Deployment completed successfully!"
}

# Function to clean up old deployments
cleanup() {
    print_status "Cleaning up old deployments..."
    
    # Stop existing containers
    docker-compose -f "$DOCKER_COMPOSE_FILE" down --remove-orphans
    
    # Remove old images (optional)
    if [ "${CLEANUP_IMAGES:-false}" = "true" ]; then
        docker image prune -f
        docker volume prune -f
    fi
    
    print_success "Cleanup completed"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --help, -h           Show this help message"
    echo "  --cleanup, -c        Clean up old deployments before starting"
    echo "  --skip-build, -s     Skip building Docker images"
    echo "  --skip-health        Skip health checks"
    echo "  --env-file FILE      Use custom environment file (default: .env.production)"
    echo ""
    echo "Environment Variables:"
    echo "  CLEANUP_IMAGES=true  Remove old Docker images during cleanup"
    echo ""
}

# Main deployment function
main() {
    local skip_build=false
    local skip_health=false
    local cleanup_first=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help|-h)
                show_usage
                exit 0
                ;;
            --cleanup|-c)
                cleanup_first=true
                shift
                ;;
            --skip-build|-s)
                skip_build=true
                shift
                ;;
            --skip-health)
                skip_health=true
                shift
                ;;
            --env-file)
                ENV_FILE="$2"
                shift 2
                ;;
            *)
                print_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    print_status "Starting Harmony SPARC deployment..."
    
    # Run deployment steps
    check_prerequisites
    validate_environment
    create_directories
    generate_ssl_certificates
    
    if [ "$cleanup_first" = true ]; then
        cleanup
    fi
    
    if [ "$skip_build" = false ]; then
        build_images
    fi
    
    run_migrations
    deploy_contracts
    start_services
    
    if [ "$skip_health" = false ]; then
        if run_health_checks; then
            show_status
        else
            print_error "Deployment failed health checks"
            exit 1
        fi
    else
        show_status
    fi
}

# Run main function with all arguments
main "$@"