#!/bin/bash

# AgentFlow API Database Migration Script
# Usage: ./database-migrate.sh [environment] [action]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MIGRATIONS_DIR="${PROJECT_ROOT}/../migrations"
NAMESPACE_PREFIX="agentflow"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Help function
show_help() {
    cat << EOF
AgentFlow API Database Migration Script

Usage: $0 [ENVIRONMENT] [ACTION] [OPTIONS]

ENVIRONMENT:
  staging     Run migrations on staging database
  production  Run migrations on production database

ACTION:
  migrate     Run all pending migrations
  rollback    Rollback last migration
  status      Show migration status
  create      Create a new migration file
  seed        Run database seeds
  reset       Reset database (WARNING: destructive)
  backup      Create database backup
  restore     Restore database from backup

OPTIONS:
  --name NAME         Name for new migration (for create action)
  --steps N           Number of steps to rollback (default: 1)
  --backup-file FILE  Backup file path (for restore action)
  --dry-run           Show what would be done without executing
  --help              Show this help message

Examples:
  $0 staging migrate
  $0 production status
  $0 staging create --name "add_user_table"
  $0 staging rollback --steps 2
  $0 production backup

EOF
}

# Get environment configuration
get_environment_config() {
    local env=$1
    
    case $env in
        staging)
            NAMESPACE="${NAMESPACE_PREFIX}-staging"
            DB_SECRET_NAME="agentflow-api-staging-db-secret"
            ;;
        production)
            NAMESPACE="${NAMESPACE_PREFIX}"
            DB_SECRET_NAME="agentflow-api-db-secret"
            ;;
        *)
            log_error "Invalid environment: $env"
            show_help
            exit 1
            ;;
    esac
}

# Get database credentials from Kubernetes secret
get_db_credentials() {
    local namespace=$1
    local secret_name=$2
    
    if ! kubectl get secret "$secret_name" -n "$namespace" &> /dev/null; then
        log_error "Database secret '$secret_name' not found in namespace '$namespace'"
        exit 1
    fi
    
    DB_HOST=$(kubectl get secret "$secret_name" -n "$namespace" -o jsonpath='{.data.host}' | base64 -d)
    DB_PORT=$(kubectl get secret "$secret_name" -n "$namespace" -o jsonpath='{.data.port}' | base64 -d)
    DB_NAME=$(kubectl get secret "$secret_name" -n "$namespace" -o jsonpath='{.data.database}' | base64 -d)
    DB_USER=$(kubectl get secret "$secret_name" -n "$namespace" -o jsonpath='{.data.username}' | base64 -d)
    DB_PASSWORD=$(kubectl get secret "$secret_name" -n "$namespace" -o jsonpath='{.data.password}' | base64 -d)
    
    export DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"
}

# Create migration job
create_migration_job() {
    local env=$1
    local action=$2
    local extra_args=${3:-""}
    
    get_environment_config "$env"
    
    local job_name="agentflow-migration-$(date +%s)"
    local image_tag="latest"
    
    # Create job manifest
    cat << EOF | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: $job_name
  namespace: $NAMESPACE
  labels:
    app: agentflow-api
    component: migration
spec:
  ttlSecondsAfterFinished: 3600
  template:
    metadata:
      labels:
        app: agentflow-api
        component: migration
    spec:
      restartPolicy: Never
      containers:
      - name: migration
        image: ghcr.io/agentflow/api:$image_tag
        command: ["/bin/sh", "-c"]
        args:
        - |
          set -e
          echo "Starting database migration: $action"
          
          # Wait for database to be ready
          until pg_isready -h \$DB_HOST -p \$DB_PORT -U \$DB_USER; do
            echo "Waiting for database..."
            sleep 2
          done
          
          # Run migration command
          case "$action" in
            migrate)
              npm run migrate:up
              ;;
            rollback)
              npm run migrate:down $extra_args
              ;;
            status)
              npm run migrate:status
              ;;
            seed)
              npm run db:seed
              ;;
            reset)
              npm run db:reset
              ;;
            *)
              echo "Unknown migration action: $action"
              exit 1
              ;;
          esac
          
          echo "Migration completed successfully"
        env:
        - name: NODE_ENV
          value: "$env"
        - name: DB_HOST
          valueFrom:
            secretKeyRef:
              name: $DB_SECRET_NAME
              key: host
        - name: DB_PORT
          valueFrom:
            secretKeyRef:
              name: $DB_SECRET_NAME
              key: port
        - name: DB_NAME
          valueFrom:
            secretKeyRef:
              name: $DB_SECRET_NAME
              key: database
        - name: DB_USER
          valueFrom:
            secretKeyRef:
              name: $DB_SECRET_NAME
              key: username
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: $DB_SECRET_NAME
              key: password
        - name: DATABASE_URL
          value: "postgresql://\$(DB_USER):\$(DB_PASSWORD)@\$(DB_HOST):\$(DB_PORT)/\$(DB_NAME)"
        resources:
          requests:
            cpu: 100m
            memory: 256Mi
          limits:
            cpu: 500m
            memory: 512Mi
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          runAsNonRoot: true
          runAsUser: 1000
          runAsGroup: 1000
      securityContext:
        fsGroup: 1000
EOF
    
    # Wait for job to complete
    log_info "Waiting for migration job to complete..."
    kubectl wait --for=condition=complete job/$job_name -n "$NAMESPACE" --timeout=600s
    
    # Show job logs
    log_info "Migration job logs:"
    kubectl logs job/$job_name -n "$NAMESPACE"
    
    # Check job status
    if kubectl get job/$job_name -n "$NAMESPACE" -o jsonpath='{.status.conditions[?(@.type=="Complete")].status}' | grep -q "True"; then
        log_success "Migration completed successfully"
    else
        log_error "Migration failed"
        exit 1
    fi
}

# Migrate function
migrate() {
    local env=$1
    local dry_run=${2:-false}
    
    log_info "Running database migrations for $env environment..."
    
    if [[ "$dry_run" == "true" ]]; then
        log_info "Dry run mode - would create migration job"
        return
    fi
    
    create_migration_job "$env" "migrate"
}

# Rollback function
rollback() {
    local env=$1
    local steps=${2:-1}
    local dry_run=${3:-false}
    
    log_info "Rolling back $steps database migration(s) for $env environment..."
    
    if [[ "$dry_run" == "true" ]]; then
        log_info "Dry run mode - would create rollback job"
        return
    fi
    
    create_migration_job "$env" "rollback" "--steps $steps"
}

# Status function
status() {
    local env=$1
    
    log_info "Checking database migration status for $env environment..."
    
    create_migration_job "$env" "status"
}

# Create migration function
create_migration() {
    local name=$1
    
    if [[ -z "$name" ]]; then
        log_error "Migration name is required"
        exit 1
    fi
    
    log_info "Creating new migration: $name"
    
    local timestamp=$(date +%Y%m%d%H%M%S)
    local filename="${timestamp}_${name}.sql"
    local filepath="${MIGRATIONS_DIR}/${filename}"
    
    # Create migrations directory if it doesn't exist
    mkdir -p "$MIGRATIONS_DIR"
    
    # Create migration file
    cat << EOF > "$filepath"
-- Migration: $name
-- Created: $(date)

-- Up migration
BEGIN;

-- Add your migration code here
-- Example:
-- CREATE TABLE users (
--     id SERIAL PRIMARY KEY,
--     email VARCHAR(255) UNIQUE NOT NULL,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );

COMMIT;

-- Down migration (for rollback)
-- BEGIN;
-- DROP TABLE IF EXISTS users;
-- COMMIT;
EOF
    
    log_success "Created migration file: $filepath"
}

# Seed function
seed() {
    local env=$1
    local dry_run=${2:-false}
    
    log_info "Running database seeds for $env environment..."
    
    if [[ "$dry_run" == "true" ]]; then
        log_info "Dry run mode - would create seed job"
        return
    fi
    
    create_migration_job "$env" "seed"
}

# Reset function
reset() {
    local env=$1
    local dry_run=${2:-false}
    
    log_warning "WARNING: This will reset the database and destroy all data!"
    
    if [[ "$env" == "production" ]]; then
        log_error "Database reset is not allowed in production environment"
        exit 1
    fi
    
    read -p "Are you sure you want to reset the database? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Operation cancelled"
        exit 0
    fi
    
    log_info "Resetting database for $env environment..."
    
    if [[ "$dry_run" == "true" ]]; then
        log_info "Dry run mode - would create reset job"
        return
    fi
    
    create_migration_job "$env" "reset"
}

# Backup function
backup() {
    local env=$1
    local backup_file=${2:-"backup-$(date +%Y%m%d-%H%M%S).sql"}
    
    get_environment_config "$env"
    get_db_credentials "$NAMESPACE" "$DB_SECRET_NAME"
    
    log_info "Creating database backup for $env environment..."
    log_info "Backup file: $backup_file"
    
    # Create backup using pg_dump
    pg_dump "$DATABASE_URL" > "$backup_file"
    
    log_success "Database backup created: $backup_file"
}

# Restore function
restore() {
    local env=$1
    local backup_file=$2
    local dry_run=${3:-false}
    
    if [[ -z "$backup_file" ]]; then
        log_error "Backup file is required for restore"
        exit 1
    fi
    
    if [[ ! -f "$backup_file" ]]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    get_environment_config "$env"
    get_db_credentials "$NAMESPACE" "$DB_SECRET_NAME"
    
    log_warning "WARNING: This will restore the database and overwrite all existing data!"
    
    read -p "Are you sure you want to restore the database? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Operation cancelled"
        exit 0
    fi
    
    log_info "Restoring database for $env environment from: $backup_file"
    
    if [[ "$dry_run" == "true" ]]; then
        log_info "Dry run mode - would restore database"
        return
    fi
    
    # Restore using psql
    psql "$DATABASE_URL" < "$backup_file"
    
    log_success "Database restored successfully"
}

# Main function
main() {
    local environment=""
    local action=""
    local name=""
    local steps=1
    local backup_file=""
    local dry_run=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            staging|production)
                environment=$1
                shift
                ;;
            migrate|rollback|status|create|seed|reset|backup|restore)
                action=$1
                shift
                ;;
            --name)
                name=$2
                shift 2
                ;;
            --steps)
                steps=$2
                shift 2
                ;;
            --backup-file)
                backup_file=$2
                shift 2
                ;;
            --dry-run)
                dry_run=true
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Validate arguments
    if [[ -z "$environment" || -z "$action" ]]; then
        log_error "Environment and action are required"
        show_help
        exit 1
    fi
    
    # Execute action
    case $action in
        migrate)
            migrate "$environment" "$dry_run"
            ;;
        rollback)
            rollback "$environment" "$steps" "$dry_run"
            ;;
        status)
            status "$environment"
            ;;
        create)
            create_migration "$name"
            ;;
        seed)
            seed "$environment" "$dry_run"
            ;;
        reset)
            reset "$environment" "$dry_run"
            ;;
        backup)
            backup "$environment" "$backup_file"
            ;;
        restore)
            restore "$environment" "$backup_file" "$dry_run"
            ;;
        *)
            log_error "Unknown action: $action"
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"