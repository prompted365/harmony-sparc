#!/bin/bash

# Development startup script for EESystem Content Curation Platform

echo "🚀 Starting EESystem Content Curation Platform - Development Mode"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "📥 Installing dependencies..."
pip install -r requirements.txt

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p uploads data static

# Set environment variables for development
export DEBUG=true
export SECRET_KEY="dev-secret-key-change-in-production"
export SQLITE_DATABASE_URL="sqlite:///./data/eesystem.db"
export REDIS_URL="redis://localhost:6379"
export CELERY_BROKER_URL="redis://localhost:6379/0"
export CELERY_RESULT_BACKEND="redis://localhost:6379/0"

# Check if Redis is running
if ! redis-cli ping > /dev/null 2>&1; then
    echo "⚠️  Redis is not running. Please start Redis first:"
    echo "   brew services start redis  # macOS with Homebrew"
    echo "   sudo systemctl start redis  # Linux with systemd"
    echo "   docker run -d -p 6379:6379 redis:alpine  # Docker"
    exit 1
fi

echo "✅ Redis is running"

# Start the FastAPI server
echo "🌐 Starting FastAPI server..."
uvicorn main:app --reload --host 0.0.0.0 --port 8000