-- Database initialization script for Harmony SPARC

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create database user for application
CREATE USER harmony_app WITH ENCRYPTED PASSWORD 'harmony_app_password';
GRANT CONNECT ON DATABASE harmony_db TO harmony_app;

-- Create schemas
CREATE SCHEMA IF NOT EXISTS harmony;
CREATE SCHEMA IF NOT EXISTS agentflow;
CREATE SCHEMA IF NOT EXISTS blockchain;
CREATE SCHEMA IF NOT EXISTS analytics;

-- Grant permissions
GRANT USAGE ON SCHEMA harmony TO harmony_app;
GRANT USAGE ON SCHEMA agentflow TO harmony_app;
GRANT USAGE ON SCHEMA blockchain TO harmony_app;
GRANT USAGE ON SCHEMA analytics TO harmony_app;

GRANT CREATE ON SCHEMA harmony TO harmony_app;
GRANT CREATE ON SCHEMA agentflow TO harmony_app;
GRANT CREATE ON SCHEMA blockchain TO harmony_app;
GRANT CREATE ON SCHEMA analytics TO harmony_app;

-- Create basic tables for sessions and metrics
CREATE TABLE IF NOT EXISTS harmony.sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255),
    session_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS harmony.metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(255) NOT NULL,
    metric_value DECIMAL,
    metric_labels JSONB,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agentflow.workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    config JSONB,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS blockchain.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tx_hash VARCHAR(66) UNIQUE NOT NULL,
    from_address VARCHAR(42),
    to_address VARCHAR(42),
    value DECIMAL,
    gas_used BIGINT,
    gas_price DECIMAL,
    block_number BIGINT,
    block_hash VARCHAR(66),
    status VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON harmony.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON harmony.sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON harmony.metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_metrics_name ON harmony.metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_workflows_status ON agentflow.workflows(status);
CREATE INDEX IF NOT EXISTS idx_transactions_hash ON blockchain.transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_transactions_block ON blockchain.transactions(block_number);

-- Create cleanup function for expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM harmony.sessions WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions on tables
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA harmony TO harmony_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA agentflow TO harmony_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA blockchain TO harmony_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA analytics TO harmony_app;

GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA harmony TO harmony_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA agentflow TO harmony_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA blockchain TO harmony_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA analytics TO harmony_app;