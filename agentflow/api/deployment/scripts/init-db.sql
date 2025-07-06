-- AgentFlow Database Initialization Script
-- This script creates the initial database schema for the AgentFlow API

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS agentflow;
CREATE SCHEMA IF NOT EXISTS metrics;
CREATE SCHEMA IF NOT EXISTS logs;

-- Set search path
SET search_path TO agentflow, public;

-- Create enum types
CREATE TYPE agent_status AS ENUM ('idle', 'busy', 'error', 'offline');
CREATE TYPE task_status AS ENUM ('pending', 'running', 'completed', 'failed');
CREATE TYPE workflow_status AS ENUM ('draft', 'active', 'paused', 'completed', 'cancelled');

-- Create agents table
CREATE TABLE IF NOT EXISTS agents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    type VARCHAR(100) NOT NULL,
    status agent_status DEFAULT 'idle',
    capabilities JSONB DEFAULT '[]'::jsonb,
    configuration JSONB DEFAULT '{}'::jsonb,
    metrics JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create workflows table
CREATE TABLE IF NOT EXISTS workflows (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status workflow_status DEFAULT 'draft',
    definition JSONB NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    status task_status DEFAULT 'pending',
    priority INTEGER DEFAULT 5,
    payload JSONB DEFAULT '{}'::jsonb,
    result JSONB,
    error TEXT,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    retry_after TIMESTAMP WITH TIME ZONE
);

-- Create financial metrics table
CREATE TABLE IF NOT EXISTS financial_metrics (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metrics_type VARCHAR(100) NOT NULL,
    value DECIMAL(20, 8) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create QUDAG operations table
CREATE TABLE IF NOT EXISTS qudag_operations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    operation_type VARCHAR(100) NOT NULL,
    input_data JSONB NOT NULL,
    output_data JSONB,
    status VARCHAR(50) DEFAULT 'pending',
    error TEXT,
    execution_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create performance metrics table in metrics schema
CREATE TABLE IF NOT EXISTS metrics.performance_metrics (
    id BIGSERIAL PRIMARY KEY,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    cpu_usage DECIMAL(5, 2),
    memory_usage_mb INTEGER,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create request logs table in logs schema
CREATE TABLE IF NOT EXISTS logs.request_logs (
    id BIGSERIAL PRIMARY KEY,
    request_id UUID DEFAULT uuid_generate_v4(),
    method VARCHAR(10) NOT NULL,
    path VARCHAR(1000) NOT NULL,
    query_params JSONB,
    headers JSONB,
    body JSONB,
    status_code INTEGER,
    response_time_ms INTEGER,
    error TEXT,
    user_agent TEXT,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_type ON agents(type);
CREATE INDEX idx_agents_last_active ON agents(last_active_at);

CREATE INDEX idx_workflows_status ON workflows(status);
CREATE INDEX idx_workflows_created_at ON workflows(created_at);

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_workflow_id ON tasks(workflow_id);
CREATE INDEX idx_tasks_agent_id ON tasks(agent_id);
CREATE INDEX idx_tasks_created_at ON tasks(created_at);
CREATE INDEX idx_tasks_priority_status ON tasks(priority DESC, status);

CREATE INDEX idx_financial_metrics_agent ON financial_metrics(agent_id);
CREATE INDEX idx_financial_metrics_timestamp ON financial_metrics(timestamp);
CREATE INDEX idx_financial_metrics_type ON financial_metrics(metrics_type);

CREATE INDEX idx_qudag_operations_status ON qudag_operations(status);
CREATE INDEX idx_qudag_operations_type ON qudag_operations(operation_type);
CREATE INDEX idx_qudag_operations_created ON qudag_operations(created_at);

CREATE INDEX idx_performance_metrics_endpoint ON metrics.performance_metrics(endpoint);
CREATE INDEX idx_performance_metrics_timestamp ON metrics.performance_metrics(timestamp);

CREATE INDEX idx_request_logs_path ON logs.request_logs(path);
CREATE INDEX idx_request_logs_timestamp ON logs.request_logs(created_at);
CREATE INDEX idx_request_logs_request_id ON logs.request_logs(request_id);

-- Create update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create partitioning for high-volume tables
-- Partition performance_metrics by month
CREATE TABLE IF NOT EXISTS metrics.performance_metrics_template (LIKE metrics.performance_metrics INCLUDING ALL);

-- Partition request_logs by day
CREATE TABLE IF NOT EXISTS logs.request_logs_template (LIKE logs.request_logs INCLUDING ALL);

-- Grant permissions
GRANT ALL PRIVILEGES ON SCHEMA agentflow TO agentflow_user;
GRANT ALL PRIVILEGES ON SCHEMA metrics TO agentflow_user;
GRANT ALL PRIVILEGES ON SCHEMA logs TO agentflow_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA agentflow TO agentflow_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA metrics TO agentflow_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA logs TO agentflow_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA agentflow TO agentflow_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA metrics TO agentflow_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA logs TO agentflow_user;

-- Insert sample data for testing
INSERT INTO agents (name, type, status, capabilities) VALUES
    ('agent-001', 'analyzer', 'idle', '["data-processing", "pattern-recognition"]'),
    ('agent-002', 'executor', 'idle', '["task-execution", "workflow-management"]'),
    ('agent-003', 'monitor', 'idle', '["performance-tracking", "alerting"]')
ON CONFLICT (name) DO NOTHING;

-- Create database statistics view
CREATE OR REPLACE VIEW agentflow.database_stats AS
SELECT 
    'agents' as table_name,
    COUNT(*) as row_count,
    pg_size_pretty(pg_total_relation_size('agentflow.agents')) as total_size
FROM agents
UNION ALL
SELECT 
    'workflows' as table_name,
    COUNT(*) as row_count,
    pg_size_pretty(pg_total_relation_size('agentflow.workflows')) as total_size
FROM workflows
UNION ALL
SELECT 
    'tasks' as table_name,
    COUNT(*) as row_count,
    pg_size_pretty(pg_total_relation_size('agentflow.tasks')) as total_size
FROM tasks;

-- Create health check function
CREATE OR REPLACE FUNCTION agentflow.health_check()
RETURNS TABLE(
    component VARCHAR,
    status VARCHAR,
    details JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'database'::VARCHAR as component,
        'healthy'::VARCHAR as status,
        jsonb_build_object(
            'version', version(),
            'uptime', EXTRACT(EPOCH FROM (now() - pg_postmaster_start_time())),
            'active_connections', (SELECT count(*) FROM pg_stat_activity),
            'database_size', pg_database_size(current_database())
        ) as details;
END;
$$ LANGUAGE plpgsql;

-- Notify completion
DO $$
BEGIN
    RAISE NOTICE 'AgentFlow database initialization completed successfully';
END
$$;