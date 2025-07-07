# EESystem Content Curation Platform - Database Schemas

## Database Architecture Overview

The EESystem Content Curation Platform uses a hybrid database architecture:

1. **AstraDB (Cassandra)** - Vector embeddings, long-term storage, content library
2. **SQLite** - Session management, short-term memory, cache
3. **Redis** - Real-time caching, queue management, session storage

## AstraDB Schema Design

### Vector Embeddings and Semantic Search

#### content_embeddings
```sql
CREATE TABLE content_embeddings (
    id UUID PRIMARY KEY,
    content_type TEXT,              -- 'reel', 'story', 'carousel', 'quote', 'thread'
    platform TEXT,                 -- 'instagram', 'tiktok', 'youtube', 'facebook', 'twitter'
    content_text TEXT,              -- Original text content
    embedding VECTOR<FLOAT, 1536>,  -- OpenAI text-embedding-3-large
    metadata MAP<TEXT, TEXT>,       -- Additional metadata
    brand_alignment_score FLOAT,    -- 0.0 to 1.0 brand alignment
    compliance_status TEXT,         -- 'approved', 'pending', 'rejected', 'review'
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- Secondary indexes for efficient queries
CREATE INDEX ON content_embeddings (content_type);
CREATE INDEX ON content_embeddings (platform);
CREATE INDEX ON content_embeddings (compliance_status);
CREATE INDEX ON content_embeddings (created_at);
```

#### brand_knowledge
```sql
CREATE TABLE brand_knowledge (
    id UUID PRIMARY KEY,
    knowledge_type TEXT,            -- 'guideline', 'voice', 'visual', 'claim', 'compliance'
    title TEXT,                     -- Human-readable title
    content TEXT,                   -- Full content/guideline text
    embedding VECTOR<FLOAT, 1536>,  -- Semantic embedding
    relevance_score FLOAT,          -- Importance weighting
    category TEXT,                  -- 'medical', 'marketing', 'legal', 'brand'
    status TEXT,                    -- 'active', 'deprecated', 'draft'
    version INT,                    -- Version number for updates
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX ON brand_knowledge (knowledge_type);
CREATE INDEX ON brand_knowledge (category);
CREATE INDEX ON brand_knowledge (status);
```

#### content_library
```sql
CREATE TABLE content_library (
    id UUID PRIMARY KEY,
    title TEXT,
    description TEXT,
    content_type TEXT,              -- 'reel', 'story', 'carousel', 'quote', 'thread'
    platform_specs MAP<TEXT, TEXT>, -- Platform-specific specifications
    script_content TEXT,            -- Video/audio script
    media_prompts TEXT,             -- AI image/video generation prompts
    compliance_notes TEXT,          -- Compliance review notes
    performance_metrics MAP<TEXT, FLOAT>, -- Engagement metrics
    status TEXT,                    -- 'draft', 'approved', 'published', 'archived'
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    published_at TIMESTAMP
);

CREATE INDEX ON content_library (content_type);
CREATE INDEX ON content_library (status);
CREATE INDEX ON content_library (published_at);
```

### Publication and Scheduling

#### publication_schedule
```sql
CREATE TABLE publication_schedule (
    id UUID PRIMARY KEY,
    content_id UUID,                -- Reference to content_library
    platform TEXT,                 -- Target platform
    scheduled_at TIMESTAMP,         -- When to publish
    cycle_week INT,                 -- Week number in themed cycle
    cycle_day INT,                  -- Day number in cycle (1-7)
    theme TEXT,                     -- Weekly theme
    priority INT,                   -- Publication priority
    status TEXT,                    -- 'scheduled', 'published', 'failed', 'cancelled'
    result_data MAP<TEXT, TEXT>,    -- Publication results/errors
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX ON publication_schedule (platform);
CREATE INDEX ON publication_schedule (scheduled_at);
CREATE INDEX ON publication_schedule (status);
CREATE INDEX ON publication_schedule (cycle_week, cycle_day);
```

#### content_templates
```sql
CREATE TABLE content_templates (
    id UUID PRIMARY KEY,
    template_name TEXT,
    content_type TEXT,              -- 'reel', 'story', 'carousel', 'quote', 'thread'
    platform TEXT,                 -- Target platform
    template_structure TEXT,        -- JSON structure for content
    script_template TEXT,           -- Script template with placeholders
    media_template TEXT,            -- Media generation template
    compliance_requirements LIST<TEXT>, -- Required compliance checks
    usage_count INT,                -- How many times used
    performance_score FLOAT,        -- Template effectiveness
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX ON content_templates (content_type);
CREATE INDEX ON content_templates (platform);
CREATE INDEX ON content_templates (performance_score);
```

### Brand and Compliance

#### brand_guidelines
```sql
CREATE TABLE brand_guidelines (
    id UUID PRIMARY KEY,
    guideline_type TEXT,            -- 'voice', 'visual', 'messaging', 'claims'
    category TEXT,                  -- 'medical', 'wellness', 'marketing', 'legal'
    title TEXT,
    description TEXT,
    requirements LIST<TEXT>,        -- Specific requirements
    restrictions LIST<TEXT>,        -- What to avoid
    examples TEXT,                  -- Positive/negative examples
    severity_level TEXT,            -- 'critical', 'important', 'preferred'
    platforms LIST<TEXT>,           -- Which platforms this applies to
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX ON brand_guidelines (guideline_type);
CREATE INDEX ON brand_guidelines (category);
CREATE INDEX ON brand_guidelines (severity_level);
```

#### compliance_checks
```sql
CREATE TABLE compliance_checks (
    id UUID PRIMARY KEY,
    content_id UUID,                -- Reference to content being checked
    check_type TEXT,                -- 'medical_claim', 'brand_voice', 'legal_review'
    check_result TEXT,              -- 'passed', 'failed', 'warning', 'manual_review'
    confidence_score FLOAT,         -- AI confidence in result
    issues_found LIST<TEXT>,        -- Specific issues identified
    recommendations TEXT,           -- Suggested improvements
    reviewer_id UUID,               -- Human reviewer if applicable
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP
);

CREATE INDEX ON compliance_checks (content_id);
CREATE INDEX ON compliance_checks (check_type);
CREATE INDEX ON compliance_checks (check_result);
```

### AI Agent Coordination

#### agent_memory
```sql
CREATE TABLE agent_memory (
    id UUID PRIMARY KEY,
    agent_type TEXT,                -- 'research', 'creation', 'compliance', 'coordination'
    memory_type TEXT,               -- 'short_term', 'long_term', 'episodic', 'semantic'
    memory_key TEXT,                -- Unique identifier for memory
    memory_content TEXT,            -- Actual memory content
    embedding VECTOR<FLOAT, 1536>,  -- Semantic embedding for retrieval
    relevance_score FLOAT,          -- Importance/relevance weighting
    context_data MAP<TEXT, TEXT>,   -- Additional context
    expires_at TIMESTAMP,           -- When memory expires (null for permanent)
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX ON agent_memory (agent_type);
CREATE INDEX ON agent_memory (memory_type);
CREATE INDEX ON agent_memory (memory_key);
CREATE INDEX ON agent_memory (expires_at);
```

#### agent_coordination
```sql
CREATE TABLE agent_coordination (
    id UUID PRIMARY KEY,
    session_id UUID,                -- Coordination session
    agent_type TEXT,                -- Agent participating
    task_description TEXT,          -- What the agent is doing
    status TEXT,                    -- 'active', 'waiting', 'completed', 'failed'
    dependencies LIST<UUID>,        -- Other agents this depends on
    results TEXT,                   -- Agent's output/results
    coordination_data MAP<TEXT, TEXT>, -- Inter-agent communication
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP
);

CREATE INDEX ON agent_coordination (session_id);
CREATE INDEX ON agent_coordination (agent_type);
CREATE INDEX ON agent_coordination (status);
```

## SQLite Schema Design

### Session Management

#### sessions
```sql
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_data TEXT,              -- JSON session data
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
```

#### user_preferences
```sql
CREATE TABLE user_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    preference_key TEXT NOT NULL,
    preference_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, preference_key)
);
```

### Short-term Memory and Cache

#### content_cache
```sql
CREATE TABLE content_cache (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    content_type TEXT,              -- 'generated_content', 'ai_response', 'api_result'
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_content_cache_expires_at ON content_cache(expires_at);
CREATE INDEX idx_content_cache_content_type ON content_cache(content_type);
```

#### generation_queue
```sql
CREATE TABLE generation_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content_type TEXT NOT NULL,
    platform TEXT NOT NULL,
    prompt_data TEXT NOT NULL,      -- JSON prompt data
    priority INTEGER DEFAULT 5,    -- 1-10, higher = more urgent
    status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    error_message TEXT,
    result_data TEXT,              -- JSON result data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

CREATE INDEX idx_generation_queue_status ON generation_queue(status);
CREATE INDEX idx_generation_queue_priority ON generation_queue(priority);
CREATE INDEX idx_generation_queue_created_at ON generation_queue(created_at);
```

### Temporary Content Storage

#### temp_content
```sql
CREATE TABLE temp_content (
    id TEXT PRIMARY KEY,
    content_type TEXT NOT NULL,
    platform TEXT NOT NULL,
    content_data TEXT NOT NULL,     -- JSON content data
    media_urls TEXT,               -- JSON array of media URLs
    generation_metadata TEXT,      -- JSON metadata from generation
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_temp_content_expires_at ON temp_content(expires_at);
CREATE INDEX idx_temp_content_content_type ON temp_content(content_type);
```

#### batch_operations
```sql
CREATE TABLE batch_operations (
    id TEXT PRIMARY KEY,
    operation_type TEXT NOT NULL,   -- 'content_generation', 'publication', 'compliance_check'
    total_items INTEGER NOT NULL,
    completed_items INTEGER DEFAULT 0,
    failed_items INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',  -- 'pending', 'running', 'completed', 'failed'
    operation_data TEXT,           -- JSON operation parameters
    results TEXT,                  -- JSON results
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX idx_batch_operations_status ON batch_operations(status);
CREATE INDEX idx_batch_operations_created_at ON batch_operations(created_at);
```

## Redis Schema Design

### Real-time Caching

#### Session Cache
```
Key Pattern: session:{session_id}
Value: JSON session data
TTL: 30 minutes
Example: session:abc123 -> {"user_id": "user123", "preferences": {...}}
```

#### Content Generation Cache
```
Key Pattern: content_gen:{hash}
Value: JSON generated content
TTL: 24 hours
Example: content_gen:sha256hash -> {"content": "...", "media_prompts": "..."}
```

#### Brand Knowledge Cache
```
Key Pattern: brand:{knowledge_type}:{key}
Value: JSON brand data
TTL: 1 hour
Example: brand:guidelines:medical_claims -> {"requirements": [...]}
```

### Queue Management

#### Content Generation Queue
```
Queue: content_generation_queue
Items: JSON task data
Priority: High priority tasks first
Example: {"content_type": "reel", "platform": "instagram", "prompt": "..."}
```

#### Publication Queue
```
Queue: publication_queue
Items: JSON publication tasks
Scheduled: Time-based scheduling
Example: {"content_id": "uuid", "platform": "tiktok", "scheduled_at": "..."}
```

#### Compliance Review Queue
```
Queue: compliance_review_queue
Items: JSON compliance tasks
Priority: Critical compliance checks first
Example: {"content_id": "uuid", "check_type": "medical_claim", "priority": 1}
```

### Real-time Coordination

#### Agent Status
```
Key Pattern: agent:{agent_type}:{session_id}
Value: JSON agent status
TTL: 5 minutes
Example: agent:research:session123 -> {"status": "active", "task": "..."}
```

#### Coordination Events
```
Key Pattern: coord:{session_id}
Value: Ordered list of events
TTL: 1 hour
Example: coord:session123 -> [{"agent": "research", "event": "started", "timestamp": "..."}]
```

## Data Relationships

### Content Flow
```
Document Upload → brand_knowledge (AstraDB)
               → content_embeddings (AstraDB)
               → content_cache (SQLite)
               → session cache (Redis)
```

### Generation Process
```
Template → content_templates (AstraDB)
        → generation_queue (SQLite)
        → content_generation_queue (Redis)
        → temp_content (SQLite)
        → content_library (AstraDB)
```

### Publication Pipeline
```
content_library → publication_schedule (AstraDB)
                → publication_queue (Redis)
                → Social Platform APIs
                → Performance metrics → content_library
```

### Compliance Workflow
```
Content → compliance_checks (AstraDB)
        → compliance_review_queue (Redis)
        → Human Review (if needed)
        → Approval → publication_schedule
```

## Performance Optimization

### AstraDB Optimizations
- **Partition Keys**: Use UUID for even distribution
- **Clustering Keys**: Order by timestamp for efficient queries
- **Secondary Indexes**: On frequently queried columns
- **Batch Operations**: Group related operations

### SQLite Optimizations
- **WAL Mode**: Better concurrency
- **Pragma Settings**: Optimize for performance
- **Regular Cleanup**: Remove expired data
- **Connection Pooling**: Reuse connections

### Redis Optimizations
- **Key Expiration**: Automatic cleanup
- **Memory Optimization**: Appropriate data structures
- **Persistence**: RDB + AOF for durability
- **Clustering**: Scale horizontally

## Backup and Recovery

### AstraDB Backup
- **Automated Snapshots**: Daily backups
- **Point-in-time Recovery**: Restore to specific timestamp
- **Cross-region Replication**: Disaster recovery
- **Export Procedures**: Data migration capabilities

### SQLite Backup
- **File-based Backup**: Copy database files
- **Incremental Backup**: Only changed data
- **Automated Scheduling**: Regular backup jobs
- **Restore Procedures**: Quick recovery process

### Redis Backup
- **RDB Snapshots**: Point-in-time backups
- **AOF Logs**: Append-only file persistence
- **Automated Backup**: Scheduled snapshots
- **Cluster Backup**: Distributed backup strategy

## Migration Strategy

### Schema Evolution
- **Version Control**: Track schema changes
- **Migration Scripts**: Automated updates
- **Rollback Procedures**: Revert changes if needed
- **Testing**: Validate migrations in staging

### Data Migration
- **ETL Pipelines**: Extract, Transform, Load
- **Validation**: Verify data integrity
- **Monitoring**: Track migration progress
- **Rollback Plan**: Restore original data

This comprehensive database schema design provides the foundation for the EESystem Content Curation Platform's data architecture, supporting all core functionality while maintaining performance, scalability, and reliability.