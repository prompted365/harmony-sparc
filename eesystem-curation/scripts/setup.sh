#!/bin/bash

# EESystem Content Curation Platform Setup Script
set -e

echo "🚀 Setting up EESystem Content Curation Platform..."

# Check if Volta is installed
if ! command -v volta &> /dev/null; then
    echo "⚠️  Volta not found. Installing Volta..."
    curl https://get.volta.sh | bash
    export VOLTA_HOME="$HOME/.volta"
    export PATH="$VOLTA_HOME/bin:$PATH"
fi

# Check if Python 3.11+ is installed
if ! python3 --version | grep -q "3\.(11\|12)"; then
    echo "⚠️  Python 3.11+ required. Please install Python 3.11 or higher."
    exit 1
fi

# Install Node.js using Volta
echo "📦 Installing Node.js and npm via Volta..."
volta install node@20.17.0
volta install npm@10.8.2

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Setup backend
echo "🐍 Setting up Python backend..."
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Create database
echo "🗄️  Setting up database..."
python -c "
from app.core.database import create_database
import asyncio
asyncio.run(create_database())
"

cd ..

# Setup frontend
echo "⚛️  Setting up React frontend..."
cd frontend
npm install
cd ..

# Setup shared types
echo "🔄 Setting up shared types..."
cd shared
npm install
cd ..

# Create environment files
echo "🔧 Creating environment files..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ Created .env file - please configure with your settings"
fi

# Setup Git hooks
echo "🪝 Setting up Git hooks..."
npx husky install

# Create uploads directory
mkdir -p uploads

# Build frontend for production test
echo "🏗️  Building frontend..."
cd frontend
npm run build
cd ..

echo "✅ Setup completed successfully!"
echo ""
echo "🎯 Next steps:"
echo "1. Configure your .env file with API keys and database settings"
echo "2. Start development servers: npm run dev"
echo "3. Open http://localhost:3000 for frontend"
echo "4. API documentation available at http://localhost:8000/api/docs"
echo ""
echo "📚 Available commands:"
echo "  npm run dev           - Start both backend and frontend"
echo "  npm run dev:backend   - Start backend only"
echo "  npm run dev:frontend  - Start frontend only"
echo "  npm run build         - Build for production"
echo "  npm run test          - Run all tests"
echo "  npm run lint          - Run linting"
echo "  npm run docker:dev    - Start with Docker"
echo ""
echo "🔧 Development URLs:"
echo "  Frontend: http://localhost:3000"
echo "  Backend: http://localhost:8000"
echo "  API Docs: http://localhost:8000/api/docs"
echo "  Redis: localhost:6379"