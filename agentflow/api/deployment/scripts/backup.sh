#!/bin/bash

# AgentFlow API Backup and Disaster Recovery Script
# Usage: ./backup.sh [action] [environment] [options]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKUP_BUCKET="s3://agentflow-backups"
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
AgentFlow API Backup and Disaster Recovery Script

Usage: $0 [ACTION] [ENVIRONMENT] [OPTIONS]

ACTIONS:
  backup      Create backup of database and configurations
  restore     Restore from backup
  list        List available backups
  cleanup     Clean up old backups
  test        Test backup integrity
  schedule    Set up automated backups

ENVIRONMENT:
  staging     Backup/restore staging environment
  production  Backup/restore production environment

OPTIONS:
  --backup-id ID      Specific backup ID to restore
  --retention-days N  Number of days to keep backups (default: 30)
  --storage-class SC  Storage class for backups (default: STANDARD_IA)
  --encrypt           Encrypt backup with KMS
  --dry-run           Show what would be done without executing
  --help              Show this help message

Examples:
  $0 backup production
  $0 restore staging --backup-id 20231201-120000
  $0 list production
  $0 cleanup production --retention-days 7
  $0 test production --backup-id 20231201-120000

EOF
}

# Get environment configuration
get_environment_config() {
    local env=$1
    
    case $env in
        staging)
            NAMESPACE="${NAMESPACE_PREFIX}-staging"
            DB_SECRET_NAME="agentflow-api-staging-db-secret"
            BACKUP_PREFIX="staging"
            ;;
        production)
            NAMESPACE="${NAMESPACE_PREFIX}"
            DB_SECRET_NAME="agentflow-api-db-secret"
            BACKUP_PREFIX="production"
            ;;
        *)
            log_error "Invalid environment: $env"
            show_help
            exit 1
            ;;
    esac
}

# Get database credentials
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
    
    export PGPASSWORD="$DB_PASSWORD"
}

# Create backup job
create_backup_job() {
    local env=$1
    local backup_id=$(date +%Y%m%d-%H%M%S)
    local encrypt=${2:-false}
    local dry_run=${3:-false}
    
    get_environment_config "$env"
    
    log_info "Creating backup for $env environment..."
    log_info "Backup ID: $backup_id"
    
    if [[ "$dry_run" == "true" ]]; then
        log_info "Dry run mode - would create backup job"
        return
    fi
    
    # Create backup job
    local job_name="agentflow-backup-${backup_id}"
    
    cat << EOF | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: $job_name
  namespace: $NAMESPACE
  labels:
    app: agentflow-api
    component: backup
    backup-id: $backup_id
spec:
  ttlSecondsAfterFinished: 86400  # 24 hours
  template:
    metadata:
      labels:
        app: agentflow-api
        component: backup
        backup-id: $backup_id
    spec:
      restartPolicy: Never
      containers:
      - name: backup
        image: postgres:15-alpine
        command:
        - /bin/sh
        - -c
        - |
          set -e
          
          echo "Starting backup process..."
          
          # Install AWS CLI
          apk add --no-cache aws-cli
          
          # Wait for database to be ready
          until pg_isready -h \$DB_HOST -p \$DB_PORT -U \$DB_USER; do
            echo "Waiting for database..."
            sleep 2
          done
          
          # Create database backup
          echo "Creating database backup..."
          pg_dump -h \$DB_HOST -p \$DB_PORT -U \$DB_USER -d \$DB_NAME \
            --verbose --clean --no-owner --no-privileges \
            | gzip > /tmp/database-backup.sql.gz
          
          # Backup Kubernetes resources
          echo "Backing up Kubernetes resources..."
          kubectl get all,configmaps,secrets,ingress,pvc -n $NAMESPACE \
            -o yaml > /tmp/k8s-resources.yaml
          
          # Create metadata
          cat > /tmp/backup-metadata.json << METADATA
{
  "backup_id": "$backup_id",
  "environment": "$env",
  "timestamp": "\$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "database": {
    "host": "\$DB_HOST",
    "database": "\$DB_NAME",
    "version": "\$(psql -h \$DB_HOST -p \$DB_PORT -U \$DB_USER -d \$DB_NAME -t -c 'SELECT version();' | head -1 | xargs)"
  },
  "kubernetes": {
    "namespace": "$NAMESPACE",
    "cluster": "\$(kubectl config current-context)"
  }
}
METADATA
          
          # Upload to S3
          echo "Uploading backup to S3..."
          aws s3 cp /tmp/database-backup.sql.gz \
            $BACKUP_BUCKET/$BACKUP_PREFIX/database/$backup_id/database-backup.sql.gz \
            --storage-class STANDARD_IA \
            $(if [[ "$encrypt" == "true" ]]; then echo "--sse aws:kms"; fi)
          
          aws s3 cp /tmp/k8s-resources.yaml \
            $BACKUP_BUCKET/$BACKUP_PREFIX/kubernetes/$backup_id/k8s-resources.yaml \
            --storage-class STANDARD_IA \
            $(if [[ "$encrypt" == "true" ]]; then echo "--sse aws:kms"; fi)
          
          aws s3 cp /tmp/backup-metadata.json \
            $BACKUP_BUCKET/$BACKUP_PREFIX/metadata/$backup_id/backup-metadata.json \
            --storage-class STANDARD_IA \
            $(if [[ "$encrypt" == "true" ]]; then echo "--sse aws:kms"; fi)
          
          echo "Backup completed successfully: $backup_id"
          
          # Verify backup
          echo "Verifying backup integrity..."
          aws s3 ls $BACKUP_BUCKET/$BACKUP_PREFIX/database/$backup_id/
          aws s3 ls $BACKUP_BUCKET/$BACKUP_PREFIX/kubernetes/$backup_id/
          aws s3 ls $BACKUP_BUCKET/$BACKUP_PREFIX/metadata/$backup_id/
          
          echo "Backup verification completed"
        
        env:
        - name: AWS_DEFAULT_REGION
          value: "us-east-1"
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
        - name: PGPASSWORD
          valueFrom:
            secretKeyRef:
              name: $DB_SECRET_NAME
              key: password
        
        volumeMounts:
        - name: aws-credentials
          mountPath: /root/.aws
          readOnly: true
        - name: tmp
          mountPath: /tmp
        
        resources:
          requests:
            cpu: 500m
            memory: 1Gi
          limits:
            cpu: 1000m
            memory: 2Gi
        
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: false  # Need write access for backup files
          runAsNonRoot: false  # postgres user needs specific permissions
          capabilities:
            drop:
            - ALL
      
      volumes:
      - name: aws-credentials
        secret:
          secretName: aws-credentials
      - name: tmp
        emptyDir: {}
      
      securityContext:
        fsGroup: 999  # postgres group
EOF
    
    # Wait for job to complete
    log_info "Waiting for backup job to complete..."
    if kubectl wait --for=condition=complete job/$job_name -n "$NAMESPACE" --timeout=1800s; then
        log_success "Backup completed successfully: $backup_id"
        
        # Show job logs
        kubectl logs job/$job_name -n "$NAMESPACE"
        
        # Clean up job
        kubectl delete job $job_name -n "$NAMESPACE"
        
        return 0
    else
        log_error "Backup failed"
        kubectl logs job/$job_name -n "$NAMESPACE"
        kubectl delete job $job_name -n "$NAMESPACE"
        return 1
    fi
}

# Restore from backup
restore_backup() {
    local env=$1
    local backup_id=$2
    local dry_run=${3:-false}
    
    if [[ -z "$backup_id" ]]; then
        log_error "Backup ID is required for restore"
        exit 1
    fi
    
    get_environment_config "$env"
    
    log_warning "WARNING: This will restore the database and may overwrite existing data!"
    
    if [[ "$env" == "production" ]]; then
        read -p "Are you sure you want to restore production? [y/N] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Operation cancelled"
            exit 0
        fi
    fi
    
    log_info "Restoring from backup: $backup_id"
    
    if [[ "$dry_run" == "true" ]]; then
        log_info "Dry run mode - would restore from backup"
        return
    fi
    
    # Verify backup exists
    if ! aws s3 ls $BACKUP_BUCKET/$BACKUP_PREFIX/metadata/$backup_id/backup-metadata.json &> /dev/null; then
        log_error "Backup not found: $backup_id"
        exit 1
    fi
    
    # Create restore job
    local job_name="agentflow-restore-$(date +%s)"
    
    cat << EOF | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: $job_name
  namespace: $NAMESPACE
  labels:
    app: agentflow-api
    component: restore
spec:
  ttlSecondsAfterFinished: 3600
  template:
    spec:
      restartPolicy: Never
      containers:
      - name: restore
        image: postgres:15-alpine
        command:
        - /bin/sh
        - -c
        - |
          set -e
          
          echo "Starting restore process for backup: $backup_id"
          
          # Install AWS CLI
          apk add --no-cache aws-cli
          
          # Download backup
          echo "Downloading backup files..."
          aws s3 cp $BACKUP_BUCKET/$BACKUP_PREFIX/database/$backup_id/database-backup.sql.gz /tmp/
          aws s3 cp $BACKUP_BUCKET/$BACKUP_PREFIX/metadata/$backup_id/backup-metadata.json /tmp/
          
          # Verify backup metadata
          echo "Verifying backup metadata..."
          cat /tmp/backup-metadata.json
          
          # Wait for database
          until pg_isready -h \$DB_HOST -p \$DB_PORT -U \$DB_USER; do
            echo "Waiting for database..."
            sleep 2
          done
          
          # Restore database
          echo "Restoring database..."
          gunzip -c /tmp/database-backup.sql.gz | \
            psql -h \$DB_HOST -p \$DB_PORT -U \$DB_USER -d \$DB_NAME
          
          echo "Database restore completed successfully"
        
        env:
        - name: AWS_DEFAULT_REGION
          value: "us-east-1"
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
        - name: PGPASSWORD
          valueFrom:
            secretKeyRef:
              name: $DB_SECRET_NAME
              key: password
        
        volumeMounts:
        - name: aws-credentials
          mountPath: /root/.aws
          readOnly: true
        - name: tmp
          mountPath: /tmp
        
        resources:
          requests:
            cpu: 500m
            memory: 1Gi
          limits:
            cpu: 1000m
            memory: 2Gi
      
      volumes:
      - name: aws-credentials
        secret:
          secretName: aws-credentials
      - name: tmp
        emptyDir: {}
EOF
    
    # Wait for restore to complete
    log_info "Waiting for restore to complete..."
    if kubectl wait --for=condition=complete job/$job_name -n "$NAMESPACE" --timeout=1800s; then
        log_success "Restore completed successfully"
        kubectl logs job/$job_name -n "$NAMESPACE"
        kubectl delete job $job_name -n "$NAMESPACE"
    else
        log_error "Restore failed"
        kubectl logs job/$job_name -n "$NAMESPACE"
        kubectl delete job $job_name -n "$NAMESPACE"
        exit 1
    fi
}

# List backups
list_backups() {
    local env=$1
    
    get_environment_config "$env"
    
    log_info "Listing backups for $env environment..."
    
    aws s3 ls $BACKUP_BUCKET/$BACKUP_PREFIX/metadata/ --recursive | \
        grep backup-metadata.json | \
        awk '{print $4}' | \
        sed 's|.*/\([^/]*\)/backup-metadata.json|\1|' | \
        sort -r | \
        while read backup_id; do
            echo "Backup ID: $backup_id"
            aws s3 cp $BACKUP_BUCKET/$BACKUP_PREFIX/metadata/$backup_id/backup-metadata.json - | \
                jq -r '. | "  Date: \(.timestamp) | Environment: \(.environment)"'
            echo
        done
}

# Cleanup old backups
cleanup_backups() {
    local env=$1
    local retention_days=${2:-30}
    local dry_run=${3:-false}
    
    get_environment_config "$env"
    
    log_info "Cleaning up backups older than $retention_days days for $env environment..."
    
    local cutoff_date=$(date -d "$retention_days days ago" +%s)
    
    aws s3 ls $BACKUP_BUCKET/$BACKUP_PREFIX/metadata/ --recursive | \
        grep backup-metadata.json | \
        while read line; do
            local file_date=$(echo "$line" | awk '{print $1" "$2}')
            local file_epoch=$(date -d "$file_date" +%s)
            local backup_id=$(echo "$line" | awk '{print $4}' | sed 's|.*/\([^/]*\)/backup-metadata.json|\1|')
            
            if [[ $file_epoch -lt $cutoff_date ]]; then
                log_info "Deleting old backup: $backup_id ($(date -d "@$file_epoch"))"
                
                if [[ "$dry_run" != "true" ]]; then
                    aws s3 rm $BACKUP_BUCKET/$BACKUP_PREFIX/database/$backup_id/ --recursive
                    aws s3 rm $BACKUP_BUCKET/$BACKUP_PREFIX/kubernetes/$backup_id/ --recursive
                    aws s3 rm $BACKUP_BUCKET/$BACKUP_PREFIX/metadata/$backup_id/ --recursive
                else
                    log_info "Dry run - would delete $backup_id"
                fi
            fi
        done
    
    log_success "Cleanup completed"
}

# Test backup integrity
test_backup() {
    local env=$1
    local backup_id=$2
    
    if [[ -z "$backup_id" ]]; then
        log_error "Backup ID is required for test"
        exit 1
    fi
    
    get_environment_config "$env"
    
    log_info "Testing backup integrity: $backup_id"
    
    # Check if backup exists
    if ! aws s3 ls $BACKUP_BUCKET/$BACKUP_PREFIX/metadata/$backup_id/backup-metadata.json &> /dev/null; then
        log_error "Backup not found: $backup_id"
        exit 1
    fi
    
    # Download and verify metadata
    local metadata=$(aws s3 cp $BACKUP_BUCKET/$BACKUP_PREFIX/metadata/$backup_id/backup-metadata.json -)
    echo "Backup metadata:"
    echo "$metadata" | jq .
    
    # Check database backup file
    local db_size=$(aws s3 ls $BACKUP_BUCKET/$BACKUP_PREFIX/database/$backup_id/database-backup.sql.gz | awk '{print $3}')
    log_info "Database backup size: $(numfmt --to=iec $db_size)"
    
    # Check Kubernetes backup file
    local k8s_size=$(aws s3 ls $BACKUP_BUCKET/$BACKUP_PREFIX/kubernetes/$backup_id/k8s-resources.yaml | awk '{print $3}')
    log_info "Kubernetes backup size: $(numfmt --to=iec $k8s_size)"
    
    log_success "Backup integrity test completed"
}

# Set up automated backups
schedule_backups() {
    local env=$1
    local schedule=${2:-"0 2 * * *"}  # Default: daily at 2 AM
    
    get_environment_config "$env"
    
    log_info "Setting up automated backups for $env environment..."
    log_info "Schedule: $schedule"
    
    cat << EOF | kubectl apply -f -
apiVersion: batch/v1
kind: CronJob
metadata:
  name: agentflow-backup-scheduled
  namespace: $NAMESPACE
  labels:
    app: agentflow-api
    component: backup
spec:
  schedule: "$schedule"
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
          - name: backup
            image: postgres:15-alpine
            command:
            - /bin/sh
            - -c
            - |
              # Use the same backup logic as in create_backup_job
              # This would call the backup script with appropriate parameters
              /scripts/backup.sh backup $env
            
            volumeMounts:
            - name: backup-scripts
              mountPath: /scripts
            - name: aws-credentials
              mountPath: /root/.aws
              readOnly: true
          
          volumes:
          - name: backup-scripts
            configMap:
              name: backup-scripts
              defaultMode: 0755
          - name: aws-credentials
            secret:
              secretName: aws-credentials
EOF
    
    log_success "Automated backup scheduled"
}

# Main function
main() {
    local action=""
    local environment=""
    local backup_id=""
    local retention_days=30
    local encrypt=false
    local dry_run=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            backup|restore|list|cleanup|test|schedule)
                action=$1
                shift
                ;;
            staging|production)
                environment=$1
                shift
                ;;
            --backup-id)
                backup_id=$2
                shift 2
                ;;
            --retention-days)
                retention_days=$2
                shift 2
                ;;
            --encrypt)
                encrypt=true
                shift
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
    if [[ -z "$action" || -z "$environment" ]]; then
        log_error "Action and environment are required"
        show_help
        exit 1
    fi
    
    # Execute action
    case $action in
        backup)
            create_backup_job "$environment" "$encrypt" "$dry_run"
            ;;
        restore)
            restore_backup "$environment" "$backup_id" "$dry_run"
            ;;
        list)
            list_backups "$environment"
            ;;
        cleanup)
            cleanup_backups "$environment" "$retention_days" "$dry_run"
            ;;
        test)
            test_backup "$environment" "$backup_id"
            ;;
        schedule)
            schedule_backups "$environment"
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