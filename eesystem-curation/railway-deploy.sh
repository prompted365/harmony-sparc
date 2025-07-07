#!/bin/bash

# Railway Deployment Script for EESystem Content Curation Platform
# This script handles deployment to Railway with proper environment management

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Railway Deployment Script${NC}"
echo -e "${GREEN}=================================${NC}"

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo -e "${RED}❌ Railway CLI not found. Please install it first:${NC}"
    echo -e "${YELLOW}npm install -g @railway/cli${NC}"
    exit 1
fi

# Check if user is logged in
if ! railway whoami &> /dev/null; then
    echo -e "${YELLOW}🔐 Please log in to Railway:${NC}"
    railway login
fi

# Function to deploy service
deploy_service() {
    local service_name=$1
    local dockerfile_path=$2
    local service_vars=$3
    
    echo -e "${GREEN}📦 Deploying ${service_name}...${NC}"
    
    # Create service if it doesn't exist
    railway service create $service_name || true
    
    # Set service variables
    if [ ! -z "$service_vars" ]; then
        echo -e "${YELLOW}🔧 Setting environment variables for ${service_name}...${NC}"
        eval $service_vars
    fi
    
    # Deploy using Docker
    railway deploy \
        --service $service_name \
        --dockerfile $dockerfile_path
    
    echo -e "${GREEN}✅ ${service_name} deployed successfully${NC}"
}

# Function to set common environment variables
set_common_vars() {
    echo -e "${YELLOW}🔧 Setting common environment variables...${NC}"
    
    # Read environment variables from .env.railway if it exists
    if [ -f ".env.railway" ]; then
        echo -e "${GREEN}📋 Loading variables from .env.railway...${NC}"
        # Note: In production, these should be set manually in Railway dashboard
        # This is just for reference
    else
        echo -e "${YELLOW}⚠️  .env.railway not found. Please set variables manually in Railway dashboard.${NC}"
    fi
}

# Function to create PostgreSQL database
setup_database() {
    echo -e "${GREEN}🗄️  Setting up PostgreSQL database...${NC}"
    
    # Create PostgreSQL plugin
    railway plugin add postgresql || true
    
    # Wait for database to be ready
    echo -e "${YELLOW}⏳ Waiting for database to be ready...${NC}"
    sleep 10
    
    # Run database migrations
    echo -e "${GREEN}🔄 Running database migrations...${NC}"
    railway run --service backend alembic upgrade head || true
}

# Function to create Redis cache
setup_redis() {
    echo -e "${GREEN}🔴 Setting up Redis cache...${NC}"
    
    # Create Redis plugin
    railway plugin add redis || true
    
    echo -e "${GREEN}✅ Redis cache configured${NC}"
}

# Function to setup custom domains
setup_domains() {
    echo -e "${GREEN}🌐 Setting up custom domains...${NC}"
    
    # Add custom domains (replace with your actual domains)
    railway domain add eesystem-curation.railway.app --service frontend || true
    railway domain add api.eesystem-curation.railway.app --service backend || true
    
    echo -e "${GREEN}✅ Custom domains configured${NC}"
}

# Function to setup monitoring
setup_monitoring() {
    echo -e "${GREEN}📊 Setting up monitoring...${NC}"
    
    # Set monitoring variables
    railway variables set ENABLE_METRICS=true
    railway variables set METRICS_PORT=9090
    
    echo -e "${GREEN}✅ Monitoring configured${NC}"
}

# Main deployment process
main() {
    echo -e "${GREEN}🚀 Starting Railway deployment...${NC}"
    
    # Check if railway.json exists
    if [ ! -f "railway.json" ]; then
        echo -e "${RED}❌ railway.json not found. Please create it first.${NC}"
        exit 1
    fi
    
    # Set common environment variables
    set_common_vars
    
    # Setup database and cache
    setup_database
    setup_redis
    
    # Deploy backend service
    deploy_service "backend" "./backend/Dockerfile.prod" "railway variables set PYTHONPATH=/app"
    
    # Deploy frontend service
    deploy_service "frontend" "./frontend/Dockerfile.prod" "railway variables set VITE_API_URL=https://api.eesystem-curation.railway.app"
    
    # Setup custom domains
    setup_domains
    
    # Setup monitoring
    setup_monitoring
    
    echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
    echo -e "${GREEN}🌐 Frontend: https://eesystem-curation.railway.app${NC}"
    echo -e "${GREEN}🔧 Backend API: https://api.eesystem-curation.railway.app${NC}"
    echo -e "${GREEN}📖 API Docs: https://api.eesystem-curation.railway.app/api/docs${NC}"
    
    # Show service status
    echo -e "${GREEN}📊 Service Status:${NC}"
    railway status
}

# Handle command line arguments
case "${1:-}" in
    "backend")
        deploy_service "backend" "./backend/Dockerfile.prod" "railway variables set PYTHONPATH=/app"
        ;;
    "frontend")
        deploy_service "frontend" "./frontend/Dockerfile.prod" "railway variables set VITE_API_URL=https://api.eesystem-curation.railway.app"
        ;;
    "database")
        setup_database
        ;;
    "redis")
        setup_redis
        ;;
    "domains")
        setup_domains
        ;;
    "monitoring")
        setup_monitoring
        ;;
    "")
        main
        ;;
    *)
        echo -e "${RED}❌ Unknown command: $1${NC}"
        echo -e "${YELLOW}Usage: $0 [backend|frontend|database|redis|domains|monitoring]${NC}"
        exit 1
        ;;
esac