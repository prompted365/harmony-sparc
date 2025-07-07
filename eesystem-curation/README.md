# EESystem Content Curation Platform

A comprehensive content curation platform for managing EESystem-related content, featuring a FastAPI backend with Python and a React frontend with TypeScript.

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 20.17.0 (managed via Volta)
- Redis (for caching and background tasks)

### Installation

1. **Clone and setup the project:**
```bash
git clone <repository-url>
cd eesystem-curation
./scripts/setup.sh
```

2. **Configure environment:**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Start development servers:**
```bash
npm run dev
```

## 📁 Project Structure

```
eesystem-curation/
├── backend/                 # Python FastAPI backend
│   ├── app/
│   │   ├── api/            # API routes
│   │   ├── core/           # Core utilities
│   │   ├── models/         # Database models
│   │   └── services/       # Business logic
│   ├── tests/              # Backend tests
│   └── requirements.txt    # Python dependencies
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom hooks
│   │   ├── services/       # API services
│   │   └── store/          # State management
│   └── package.json        # Frontend dependencies
├── shared/                 # Shared TypeScript types
│   └── types/
├── docs/                   # Documentation
├── scripts/                # Development scripts
├── config/                 # Configuration files
└── docker-compose.dev.yml  # Development environment
```

## 🛠️ Development

### Available Scripts

```bash
# Development
npm run dev                 # Start both backend and frontend
npm run dev:backend         # Start backend only
npm run dev:frontend        # Start frontend only

# Building
npm run build              # Build both applications
npm run build:frontend     # Build frontend only
npm run build:backend      # Install backend dependencies

# Testing
npm run test               # Run all tests
npm run test:frontend      # Run frontend tests
npm run test:backend       # Run backend tests

# Linting
npm run lint               # Lint all code
npm run lint:frontend      # Lint frontend code
npm run lint:backend       # Lint backend code

# Docker
npm run docker:dev         # Start development environment
npm run docker:build       # Build Docker images
```

### Technology Stack

**Backend:**
- FastAPI (Python web framework)
- SQLAlchemy (Database ORM)
- Pydantic (Data validation)
- Redis (Caching and background tasks)
- SQLite (Development database)
- AstraDB (Production database)

**Frontend:**
- React 18 (UI library)
- TypeScript (Type safety)
- Vite (Build tool)
- TailwindCSS (Styling)
- React Query (Data fetching)
- Zustand (State management)
- React Router (Navigation)

**Development Tools:**
- Volta (Node.js version management)
- ESLint & Prettier (Code formatting)
- Vitest (Testing framework)
- Docker (Containerization)
- Husky (Git hooks)

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Application
DEBUG=true
HOST=0.0.0.0
PORT=8000

# Database
DATABASE_URL=sqlite:///./eesystem_curation.db

# Authentication
SECRET_KEY=your-secret-key-here
ACCESS_TOKEN_EXPIRE_MINUTES=30

# External APIs
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key

# Redis
REDIS_URL=redis://localhost:6379
```

### Database Setup

The platform supports both SQLite (development) and AstraDB (production):

**SQLite (Development):**
```bash
# Automatically configured - no setup needed
```

**AstraDB (Production):**
```env
ASTRADB_APPLICATION_TOKEN=your_token
ASTRADB_DATABASE_ID=your_database_id
ASTRADB_KEYSPACE=eesystem_curation
```

## 🐳 Docker Development

Start the complete development environment:

```bash
docker-compose -f docker-compose.dev.yml up
```

This starts:
- Backend API (port 8000)
- Frontend app (port 3000)
- Redis (port 6379)
- Nginx proxy (port 80)

## 🧪 Testing

### Backend Tests
```bash
cd backend
python -m pytest
```

### Frontend Tests
```bash
cd frontend
npm test
```

### Integration Tests
```bash
npm run test
```

## 📚 API Documentation

When running the backend, API documentation is available at:
- Swagger UI: http://localhost:8000/api/docs
- ReDoc: http://localhost:8000/api/redoc

## 🚀 Deployment

### Production Build
```bash
npm run build
```

### Docker Production
```bash
docker-compose -f docker-compose.prod.yml up
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License.

## 🆘 Support

For issues and support:
1. Check the documentation in `/docs`
2. Review existing issues
3. Create a new issue with detailed information

## 🎯 Features

- **Content Management**: Upload, categorize, and manage various content types
- **User Authentication**: Secure login and role-based access control
- **Curation Workflow**: Automated content review and approval processes
- **Analytics Dashboard**: Content performance and engagement metrics
- **Search & Filter**: Advanced content discovery capabilities
- **API Integration**: RESTful API for external integrations
- **Real-time Updates**: Live content status updates
- **File Upload**: Support for multiple file types and formats
- **Responsive Design**: Mobile-friendly interface
- **Dark Mode**: Theme switching capability

## 🔮 Roadmap

- [ ] Advanced AI-powered content categorization
- [ ] Multi-language support
- [ ] Advanced analytics and reporting
- [ ] Content versioning and history
- [ ] Bulk operations and batch processing
- [ ] Advanced search with AI semantic search
- [ ] Content recommendation engine
- [ ] Integration with external content sources
- [ ] Advanced user permissions and roles
- [ ] Content scheduling and publishing