#!/bin/bash

# AgentFlow Database Services Health Check Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load environment variables
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
elif [ -f ".env.production" ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
fi

# Default values
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5433}
DB_NAME=${DB_NAME:-agentflow}
DB_USER=${DB_USER:-agentflow_user}
DB_PASSWORD=${DB_PASSWORD:-supersecret123}

REDIS_HOST=${REDIS_HOST:-localhost}
REDIS_PORT=${REDIS_PORT:-6380}
REDIS_PASSWORD=${REDIS_PASSWORD:-redissecret123}

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}     AgentFlow Services Health Check${NC}"
echo -e "${BLUE}================================================${NC}"
echo

# Check PostgreSQL
echo -e "${YELLOW}Checking PostgreSQL...${NC}"
if PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT version();" &> /dev/null; then
    echo -e "${GREEN}✓ PostgreSQL is running and accessible${NC}"
    
    # Check database tables
    TABLES=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'agentflow';")
    echo -e "  Tables in agentflow schema: $TABLES"
    
    # Check health function
    if PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT * FROM agentflow.health_check();" &> /dev/null; then
        echo -e "  Health check function: ${GREEN}OK${NC}"
    fi
else
    echo -e "${RED}✗ PostgreSQL is not accessible${NC}"
    echo -e "  Check if the service is running and credentials are correct"
fi

echo

# Check Redis
echo -e "${YELLOW}Checking Redis...${NC}"
if redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASSWORD ping &> /dev/null; then
    echo -e "${GREEN}✓ Redis is running and accessible${NC}"
    
    # Get Redis info
    USED_MEMORY=$(redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASSWORD INFO memory 2>/dev/null | grep used_memory_human | cut -d: -f2 | tr -d '\r')
    CONNECTED_CLIENTS=$(redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASSWORD INFO clients 2>/dev/null | grep connected_clients | cut -d: -f2 | tr -d '\r')
    
    echo -e "  Memory usage: $USED_MEMORY"
    echo -e "  Connected clients: $CONNECTED_CLIENTS"
else
    echo -e "${RED}✗ Redis is not accessible${NC}"
    echo -e "  Check if the service is running and credentials are correct"
fi

echo

# Check Docker containers
echo -e "${YELLOW}Checking Docker containers...${NC}"
if docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep agentflow; then
    echo -e "${GREEN}✓ Containers are running${NC}"
else
    echo -e "${RED}✗ No AgentFlow containers found${NC}"
    echo -e "  Run './scripts/start-services.sh' to start the services"
fi

echo
echo -e "${BLUE}================================================${NC}"

# Test database connection from Node.js
echo -e "${YELLOW}Testing database connection from Node.js...${NC}"

# Create a simple test script
cat > /tmp/test-db-connection.js << 'EOF'
const { Client } = require('pg');
const redis = require('redis');

async function testConnections() {
    // Test PostgreSQL
    console.log('Testing PostgreSQL connection...');
    const pgClient = new Client({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5433,
        database: process.env.DB_NAME || 'agentflow',
        user: process.env.DB_USER || 'agentflow_user',
        password: process.env.DB_PASSWORD || 'supersecret123'
    });
    
    try {
        await pgClient.connect();
        const result = await pgClient.query('SELECT NOW()');
        console.log('✓ PostgreSQL connected:', result.rows[0].now);
        await pgClient.end();
    } catch (error) {
        console.error('✗ PostgreSQL connection failed:', error.message);
    }
    
    // Test Redis
    console.log('\nTesting Redis connection...');
    const redisClient = redis.createClient({
        socket: {
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6380
        },
        password: process.env.REDIS_PASSWORD || 'redissecret123'
    });
    
    try {
        await redisClient.connect();
        await redisClient.set('test-key', 'test-value');
        const value = await redisClient.get('test-key');
        console.log('✓ Redis connected: test-key =', value);
        await redisClient.del('test-key');
        await redisClient.quit();
    } catch (error) {
        console.error('✗ Redis connection failed:', error.message);
    }
}

testConnections().catch(console.error);
EOF

# Check if required npm packages are installed
if [ -f "package.json" ] && command -v node &> /dev/null; then
    if [ -d "node_modules/pg" ] && [ -d "node_modules/redis" ]; then
        node /tmp/test-db-connection.js
    else
        echo -e "${YELLOW}Skipping Node.js connection test (pg or redis package not installed)${NC}"
    fi
    rm -f /tmp/test-db-connection.js
fi