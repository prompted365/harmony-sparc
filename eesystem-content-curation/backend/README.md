# EESystem Content Curation Platform - Backend

A comprehensive FastAPI backend for AI-powered content curation and management with multi-agent coordination, advanced analytics, and enterprise-grade features.

## 🚀 Features

### Core Features
- **Content Management**: Full CRUD operations for articles, blog posts, social media content, and more
- **Document Processing**: Upload, process, and analyze documents with AI-powered text extraction
- **AI Agent Coordination**: Multi-agent system for content generation, analysis, and optimization
- **Vector Search**: Advanced search using AstraDB with semantic similarity
- **Publishing**: Automated content scheduling and multi-channel publishing
- **Brand Compliance**: AI-powered brand guideline enforcement and compliance checking
- **Analytics**: Comprehensive performance tracking and reporting
- **Memory Management**: Persistent context and knowledge base for AI agents

### Technical Features
- **FastAPI**: High-performance async API framework
- **SQLAlchemy**: Advanced ORM with async support
- **AstraDB**: Vector database for semantic search
- **Redis**: Caching and session management
- **Celery**: Background task processing
- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: API protection and abuse prevention
- **Prometheus Metrics**: Monitoring and observability
- **Docker Support**: Containerized deployment

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   FastAPI App   │    │   Celery Tasks  │    │   Redis Cache   │
│                 │    │                 │    │                 │
│ • REST API      │    │ • Document Proc │    │ • Sessions      │
│ • WebSocket     │    │ • AI Generation │    │ • Rate Limiting │
│ • Auth/Security │    │ • Publishing    │    │ • Task Queue    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   SQLite DB     │    │   AstraDB       │    │  External APIs  │
│                 │    │                 │    │                 │
│ • User Data     │    │ • Vector Search │    │ • Requesty.ai   │
│ • Content       │    │ • Embeddings    │    │ • OpenAI        │
│ • Analytics     │    │ • Semantic Data │    │ • Anthropic     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📦 Installation

### Prerequisites
- Python 3.11+
- Redis
- SQLite (included)
- AstraDB account (for vector search)

### Quick Start

1. **Clone and navigate to backend:**
   ```bash
   cd eesystem-content-curation/backend
   ```

2. **Set up environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # Linux/Mac
   # or
   venv\Scripts\activate  # Windows
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Start services:**
   ```bash
   # Terminal 1: Start Redis
   redis-server
   
   # Terminal 2: Start FastAPI
   ./scripts/start_dev.sh
   
   # Terminal 3: Start Celery (optional)
   ./scripts/start_celery.sh
   ```

### Docker Setup (Recommended)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DEBUG` | Debug mode | `false` |
| `SECRET_KEY` | JWT secret key | Required |
| `SQLITE_DATABASE_URL` | SQLite database path | `sqlite:///./eesystem.db` |
| `ASTRA_DB_ID` | AstraDB database ID | Required |
| `ASTRA_DB_TOKEN` | AstraDB access token | Required |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `OPENAI_API_KEY` | OpenAI API key | Optional |
| `REQUESTY_API_KEY` | Requesty.ai API key | Optional |

See `.env.example` for complete configuration options.

## 📚 API Documentation

### Interactive Documentation
- **Swagger UI**: http://localhost:8000/api/docs
- **ReDoc**: http://localhost:8000/api/redoc
- **OpenAPI JSON**: http://localhost:8000/api/openapi.json

### Main Endpoints

#### Authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `GET /api/v1/auth/me` - Current user info
- `POST /api/v1/auth/change-password` - Change password

#### Content Management
- `GET /api/v1/content` - List content
- `POST /api/v1/content` - Create content
- `GET /api/v1/content/{id}` - Get content
- `PUT /api/v1/content/{id}` - Update content
- `DELETE /api/v1/content/{id}` - Delete content
- `POST /api/v1/content/{id}/publish` - Publish content

#### Document Management
- `POST /api/v1/documents/upload` - Upload document
- `GET /api/v1/documents` - List documents
- `GET /api/v1/documents/{id}` - Get document
- `POST /api/v1/documents/{id}/process` - Process document

#### AI Agents
- `GET /api/v1/agents` - List agents
- `POST /api/v1/agents` - Create agent
- `POST /api/v1/agents/tasks` - Create task
- `GET /api/v1/agents/tasks` - List tasks

#### Search
- `POST /api/v1/search` - Search content and documents
- `GET /api/v1/search/suggestions` - Get search suggestions

#### Publishing
- `POST /api/v1/publishing/publications` - Create publication
- `GET /api/v1/publishing/publications` - List publications
- `POST /api/v1/publishing/publications/{id}/publish` - Publish now

#### Brand Management
- `POST /api/v1/brand/profiles` - Create brand profile
- `GET /api/v1/brand/profiles` - List brand profiles
- `POST /api/v1/brand/profiles/{id}/check-compliance` - Check compliance

#### Analytics
- `GET /api/v1/analytics/overview` - Analytics dashboard
- `GET /api/v1/analytics/content` - Content performance
- `POST /api/v1/analytics/events` - Track event

#### Memory Management
- `POST /api/v1/memory` - Create memory
- `GET /api/v1/memory` - List memories
- `GET /api/v1/memory/key/{key}` - Get memory by key

#### LLM Integration
- `POST /api/v1/llm/chat` - Chat completion
- `POST /api/v1/llm/generate-content` - Generate content
- `POST /api/v1/llm/analyze-content` - Analyze content

## 🛡️ Security

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (Admin, Editor, Viewer, Agent)
- Permission-based endpoint protection
- Secure password hashing with bcrypt

### Security Middleware
- Rate limiting (100 requests/minute by default)
- CORS protection
- Security headers (XSS, CSRF, etc.)
- Request/response logging
- Error handling

### Best Practices
- Environment-based configuration
- Secure secret management
- Input validation and sanitization
- SQL injection prevention
- API key rotation support

## 📊 Monitoring

### Health Checks
- `GET /api/v1/health` - Application health
- `GET /api/v1/health/ready` - Readiness check
- `GET /api/v1/health/live` - Liveness check

### Metrics
- `GET /metrics` - Prometheus metrics
- Request count and duration
- Active connections
- Database health
- Redis connectivity

### Celery Monitoring
- **Flower UI**: http://localhost:5555
- Task monitoring and management
- Worker status and performance
- Queue management

## 🔄 Background Tasks

### Task Categories
- **Document Processing**: Text extraction, AI analysis
- **Content Generation**: AI-powered content creation
- **Publishing**: Scheduled content publishing
- **AI Analysis**: Content analysis and optimization
- **Maintenance**: Cleanup and optimization tasks

### Task Management
```bash
# Monitor tasks
celery -A services.celery_app inspect active

# Cancel task
celery -A services.celery_app control revoke <task_id>

# Purge queue
celery -A services.celery_app purge
```

## 🧪 Testing

### Run Tests
```bash
# Unit tests
pytest tests/unit/

# Integration tests
pytest tests/integration/

# All tests with coverage
pytest --cov=. --cov-report=html
```

### Test Categories
- Unit tests for individual components
- Integration tests for API endpoints
- Database tests for data integrity
- Authentication tests for security
- Performance tests for scalability

## 🚀 Deployment

### Development
```bash
./scripts/start_dev.sh
```

### Production with Docker
```bash
# Build and start
docker-compose -f docker-compose.prod.yml up -d

# Scale workers
docker-compose -f docker-compose.prod.yml up -d --scale celery_worker=3
```

### Environment Setup
1. Set production environment variables
2. Configure AstraDB connection
3. Set up Redis cluster (for production)
4. Configure reverse proxy (nginx)
5. Set up SSL certificates
6. Configure monitoring and logging

## 📝 Development Guidelines

### Code Style
- Follow PEP 8 guidelines
- Use type hints for all functions
- Document all public APIs
- Write comprehensive tests
- Use meaningful variable names

### Database Migrations
```bash
# Create migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Downgrade
alembic downgrade -1
```

### Adding New Endpoints
1. Create Pydantic models in `api/routes/`
2. Implement route handlers
3. Add permission requirements
4. Write tests
5. Update documentation

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Write tests for new features
4. Ensure all tests pass
5. Submit pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

- **Documentation**: Full API documentation at `/api/docs`
- **Issues**: GitHub issues for bug reports
- **Discord**: Community support channel
- **Email**: support@eesystem.ai

## 🔮 Roadmap

### Upcoming Features
- [ ] GraphQL API support
- [ ] Multi-tenant architecture
- [ ] Advanced AI model fine-tuning
- [ ] Real-time collaboration
- [ ] Mobile API optimizations
- [ ] Advanced analytics dashboard
- [ ] Workflow automation engine
- [ ] Integration marketplace

---

Built with ❤️ for the EESystem Content Curation Platform