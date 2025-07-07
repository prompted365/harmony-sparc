#!/bin/bash

# Railway Setup Script for EESystem Content Curation Platform
# This script sets up Railway project and configures environment variables

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Railway Setup Script${NC}"
echo -e "${GREEN}========================${NC}"

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo -e "${RED}❌ Railway CLI not found. Installing...${NC}"
    npm install -g @railway/cli
fi

# Check if user is logged in
if ! railway whoami &> /dev/null; then
    echo -e "${YELLOW}🔐 Please log in to Railway:${NC}"
    railway login
fi

# Function to prompt for environment variables
prompt_for_env_vars() {
    echo -e "${BLUE}🔧 Setting up environment variables...${NC}"
    echo -e "${YELLOW}Please provide the following environment variables:${NC}"
    
    # JWT Secret
    read -p "JWT Secret (leave blank for auto-generated): " jwt_secret
    if [ -z "$jwt_secret" ]; then
        jwt_secret=$(openssl rand -hex 32)
        echo -e "${GREEN}✅ Generated JWT Secret: $jwt_secret${NC}"
    fi
    
    # AstraDB Configuration
    read -p "AstraDB Application Token: " astra_token
    read -p "AstraDB Database ID: " astra_db_id
    read -p "AstraDB Region (default: us-east-1): " astra_region
    astra_region=${astra_region:-us-east-1}
    read -p "AstraDB Keyspace (default: eesystem_curation): " astra_keyspace
    astra_keyspace=${astra_keyspace:-eesystem_curation}
    
    # OpenAI Configuration
    read -p "OpenAI API Key: " openai_key
    
    # Sentry Configuration (optional)
    read -p "Sentry DSN (optional): " sentry_dsn
    read -p "Frontend Sentry DSN (optional): " frontend_sentry_dsn
    
    # Redis Password
    read -p "Redis Password (leave blank for auto-generated): " redis_password
    if [ -z "$redis_password" ]; then
        redis_password=$(openssl rand -hex 16)
        echo -e "${GREEN}✅ Generated Redis Password: $redis_password${NC}"
    fi
    
    # Set environment variables
    railway variables set JWT_SECRET="$jwt_secret"
    railway variables set ASTRA_DB_APPLICATION_TOKEN="$astra_token"
    railway variables set ASTRA_DB_ID="$astra_db_id"
    railway variables set ASTRA_DB_REGION="$astra_region"
    railway variables set ASTRA_DB_KEYSPACE="$astra_keyspace"
    railway variables set OPENAI_API_KEY="$openai_key"
    railway variables set REDIS_PASSWORD="$redis_password"
    
    if [ ! -z "$sentry_dsn" ]; then
        railway variables set SENTRY_DSN="$sentry_dsn"
    fi
    
    if [ ! -z "$frontend_sentry_dsn" ]; then
        railway variables set VITE_SENTRY_DSN="$frontend_sentry_dsn"
    fi
    
    # Set common environment variables
    railway variables set NODE_ENV="production"
    railway variables set LOG_LEVEL="info"
    railway variables set DEBUG="false"
    railway variables set ENVIRONMENT="production"
    railway variables set ALLOWED_ORIGINS="https://eesystem-curation.railway.app,https://api.eesystem-curation.railway.app"
    railway variables set OPENAI_MODEL="gpt-4-turbo-preview"
    railway variables set OPENAI_MAX_TOKENS="4000"
    railway variables set EMBEDDING_MODEL="text-embedding-3-small"
    railway variables set SENTRY_ENVIRONMENT="production"
    railway variables set ENABLE_METRICS="true"
    railway variables set MAX_FILE_SIZE="10485760"
    railway variables set ALLOWED_FILE_TYPES="image/jpeg,image/png,image/gif,video/mp4,application/pdf"
    railway variables set CACHE_TTL="300"
    railway variables set CACHE_MAX_SIZE="1000"
    railway variables set RATE_LIMIT_REQUESTS="100"
    railway variables set RATE_LIMIT_WINDOW="60"
    railway variables set WS_HEARTBEAT_INTERVAL="30"
    railway variables set WS_MAX_CONNECTIONS="1000"
    railway variables set VITE_API_URL="https://api.eesystem-curation.railway.app"
    railway variables set VITE_WS_URL="wss://api.eesystem-curation.railway.app"
    railway variables set VITE_ENVIRONMENT="production"
    railway variables set VITE_ENABLE_ANALYTICS="true"
    railway variables set BACKUP_ENABLED="true"
    railway variables set BACKUP_SCHEDULE="0 2 * * *"
    railway variables set BACKUP_RETENTION_DAYS="30"
    railway variables set SECURE_COOKIES="true"
    railway variables set CSRF_PROTECTION="true"
    railway variables set HELMET_ENABLED="true"
    
    echo -e "${GREEN}✅ Environment variables set successfully${NC}"
}

# Function to create Railway project
create_project() {
    echo -e "${BLUE}📁 Creating Railway project...${NC}"
    
    # Create new project
    railway init
    
    # Link to existing project if it exists
    read -p "Link to existing project? (y/n): " link_existing
    if [ "$link_existing" = "y" ]; then
        railway link
    fi
    
    echo -e "${GREEN}✅ Railway project configured${NC}"
}

# Function to setup services
setup_services() {
    echo -e "${BLUE}🔧 Setting up Railway services...${NC}"
    
    # Create backend service
    railway service create backend || true
    
    # Create frontend service
    railway service create frontend || true
    
    echo -e "${GREEN}✅ Services created${NC}"
}

# Function to setup plugins
setup_plugins() {
    echo -e "${BLUE}🔌 Setting up Railway plugins...${NC}"
    
    # Add PostgreSQL plugin
    railway plugin add postgresql || true
    
    # Add Redis plugin
    railway plugin add redis || true
    
    echo -e "${GREEN}✅ Plugins configured${NC}"
}

# Function to setup domains
setup_domains() {
    echo -e "${BLUE}🌐 Setting up custom domains...${NC}"
    
    # Get project info
    project_name=$(railway project info --json | jq -r '.name')
    
    # Add custom domains
    railway domain add "$project_name.railway.app" --service frontend || true
    railway domain add "api-$project_name.railway.app" --service backend || true
    
    echo -e "${GREEN}✅ Domains configured${NC}"
    echo -e "${YELLOW}📝 Note: Update domain names in environment variables if needed${NC}"
}

# Function to create GitHub Actions workflow
create_github_workflow() {
    echo -e "${BLUE}🔄 Creating GitHub Actions workflow...${NC}"
    
    mkdir -p .github/workflows
    
    cat > .github/workflows/deploy.yml << 'EOF'
name: Deploy to Railway

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:13
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
    
    - name: Set up Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '20'
    
    - name: Install dependencies
      run: |
        npm install
        cd frontend && npm install
        cd ../backend && pip install -r requirements.txt
    
    - name: Run tests
      run: |
        npm run test
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
        REDIS_URL: redis://localhost:6379
    
    - name: Run linting
      run: |
        npm run lint

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Install Railway CLI
      run: npm install -g @railway/cli
    
    - name: Deploy to Railway
      run: railway deploy --service backend --detach
      env:
        RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
    
    - name: Deploy Frontend
      run: railway deploy --service frontend --detach
      env:
        RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
EOF
    
    echo -e "${GREEN}✅ GitHub Actions workflow created${NC}"
    echo -e "${YELLOW}📝 Note: Add RAILWAY_TOKEN to your GitHub repository secrets${NC}"
}

# Function to show final instructions
show_instructions() {
    echo -e "${GREEN}🎉 Railway setup completed successfully!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo -e "${BLUE}1. Deploy your application:${NC}"
    echo -e "   ./railway-deploy.sh"
    echo ""
    echo -e "${BLUE}2. Check deployment status:${NC}"
    echo -e "   railway status"
    echo ""
    echo -e "${BLUE}3. View application logs:${NC}"
    echo -e "   railway logs"
    echo ""
    echo -e "${BLUE}4. Access your application:${NC}"
    echo -e "   railway open"
    echo ""
    echo -e "${BLUE}5. Set up GitHub Actions (optional):${NC}"
    echo -e "   - Add RAILWAY_TOKEN to GitHub repository secrets"
    echo -e "   - Push to main branch to trigger deployment"
    echo ""
    echo -e "${YELLOW}Useful commands:${NC}"
    echo -e "${BLUE}• View environment variables:${NC} railway variables"
    echo -e "${BLUE}• Connect to database:${NC} railway db connect"
    echo -e "${BLUE}• View metrics:${NC} railway metrics"
    echo -e "${BLUE}• Scale services:${NC} railway scale"
    echo ""
    echo -e "${GREEN}✅ Happy deploying! 🚀${NC}"
}

# Main setup process
main() {
    echo -e "${GREEN}🚀 Starting Railway setup...${NC}"
    
    # Create Railway project
    create_project
    
    # Setup services
    setup_services
    
    # Setup plugins
    setup_plugins
    
    # Prompt for environment variables
    prompt_for_env_vars
    
    # Setup domains
    setup_domains
    
    # Create GitHub Actions workflow
    read -p "Create GitHub Actions workflow? (y/n): " create_workflow
    if [ "$create_workflow" = "y" ]; then
        create_github_workflow
    fi
    
    # Show final instructions
    show_instructions
}

# Handle command line arguments
case "${1:-}" in
    "env")
        prompt_for_env_vars
        ;;
    "services")
        setup_services
        ;;
    "plugins")
        setup_plugins
        ;;
    "domains")
        setup_domains
        ;;
    "workflow")
        create_github_workflow
        ;;
    "")
        main
        ;;
    *)
        echo -e "${RED}❌ Unknown command: $1${NC}"
        echo -e "${YELLOW}Usage: $0 [env|services|plugins|domains|workflow]${NC}"
        exit 1
        ;;
esac