#!/bin/bash

# Celery startup script for EESystem Content Curation Platform

echo "🔄 Starting Celery Worker and Beat for EESystem Content Curation Platform"

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

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

# Start Celery worker in background
echo "🔄 Starting Celery worker..."
celery -A services.celery_app worker --loglevel=info --queues=document_processing,content_generation,publishing,ai_analysis,maintenance &

# Start Celery beat (scheduler) in background
echo "⏰ Starting Celery beat (scheduler)..."
celery -A services.celery_app beat --loglevel=info &

# Start Flower (monitoring) in background
echo "🌸 Starting Flower (Celery monitoring)..."
celery -A services.celery_app flower --port=5555 &

echo "✅ All Celery services started!"
echo "📊 Flower monitoring available at: http://localhost:5555"
echo "📝 Press Ctrl+C to stop all services"

# Wait for all background processes
wait