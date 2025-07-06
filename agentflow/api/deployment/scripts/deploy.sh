#!/bin/bash

# AgentFlow API Deployment Script
# Usage: ./deploy.sh [environment] [action]
# Environment: staging, production
# Action: deploy, rollback, status, logs

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
HELM_CHART_PATH="${PROJECT_ROOT}/helm/agentflow-api"
NAMESPACE_PREFIX="agentflow"
REGISTRY="ghcr.io"
IMAGE_NAME="agentflow/api"

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
AgentFlow API Deployment Script

Usage: $0 [ENVIRONMENT] [ACTION] [OPTIONS]

ENVIRONMENT:
  staging     Deploy to staging environment
  production  Deploy to production environment

ACTION:
  deploy      Deploy the application
  rollback    Rollback to previous version
  status      Show deployment status
  logs        Show application logs
  scale       Scale the deployment
  restart     Restart the deployment

OPTIONS:
  --image-tag TAG     Specific image tag to deploy (default: latest)
  --replicas N        Number of replicas (for scale action)
  --dry-run           Show what would be done without executing
  --help              Show this help message

Examples:
  $0 staging deploy
  $0 production deploy --image-tag v1.2.3
  $0 staging rollback
  $0 production status
  $0 staging logs
  $0 production scale --replicas 5

EOF
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if kubectl is available
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    # Check if helm is available
    if ! command -v helm &> /dev/null; then
        log_error "helm is not installed or not in PATH"
        exit 1
    fi
    
    # Check if we can connect to the cluster
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Get environment configuration
get_environment_config() {
    local env=$1
    
    case $env in
        staging)
            NAMESPACE="${NAMESPACE_PREFIX}-staging"
            VALUES_FILE="${HELM_CHART_PATH}/values-staging.yaml"
            INGRESS_HOST="api-staging.agentflow.ai"
            ;;
        production)
            NAMESPACE="${NAMESPACE_PREFIX}"
            VALUES_FILE="${HELM_CHART_PATH}/values-production.yaml"
            INGRESS_HOST="api.agentflow.ai"
            ;;
        *)
            log_error "Invalid environment: $env"
            show_help
            exit 1
            ;;
    esac
}

# Deploy function
deploy() {
    local env=$1
    local image_tag=${2:-latest}
    local dry_run=${3:-false}
    
    get_environment_config "$env"
    
    log_info "Deploying AgentFlow API to $env environment..."
    log_info "Image tag: $image_tag"
    log_info "Namespace: $NAMESPACE"
    log_info "Values file: $VALUES_FILE"
    
    # Create namespace if it doesn't exist
    if [[ "$dry_run" != "true" ]]; then
        kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    fi
    
    # Prepare helm command
    local helm_cmd="helm upgrade --install agentflow-api-$env \
        \"$HELM_CHART_PATH\" \
        --namespace \"$NAMESPACE\" \
        --values \"$VALUES_FILE\" \
        --set image.tag=\"$image_tag\" \
        --set ingress.hosts[0].host=\"$INGRESS_HOST\" \
        --wait --timeout=600s"
    
    if [[ "$dry_run" == "true" ]]; then
        helm_cmd="$helm_cmd --dry-run"
        log_info "Dry run mode - would execute:"
        echo "$helm_cmd"
    else
        log_info "Executing deployment..."
        eval "$helm_cmd"
        
        # Wait for deployment to be ready
        log_info "Waiting for deployment to be ready..."
        kubectl wait --for=condition=available deployment/agentflow-api-$env -n "$NAMESPACE" --timeout=300s
        
        # Run smoke test
        log_info "Running smoke test..."
        if curl -f "https://$INGRESS_HOST/health" > /dev/null 2>&1; then
            log_success "Smoke test passed"
        else
            log_warning "Smoke test failed, but deployment might still be starting"
        fi
        
        log_success "Deployment completed successfully"
    fi
}

# Rollback function
rollback() {
    local env=$1
    local dry_run=${2:-false}
    
    get_environment_config "$env"
    
    log_info "Rolling back AgentFlow API in $env environment..."
    
    if [[ "$dry_run" == "true" ]]; then
        log_info "Dry run mode - would execute:"
        echo "helm rollback agentflow-api-$env -n $NAMESPACE"
    else
        helm rollback "agentflow-api-$env" -n "$NAMESPACE"
        
        # Wait for rollback to complete
        kubectl wait --for=condition=available deployment/agentflow-api-$env -n "$NAMESPACE" --timeout=300s
        
        log_success "Rollback completed successfully"
    fi
}

# Status function
status() {
    local env=$1
    
    get_environment_config "$env"
    
    log_info "Checking status of AgentFlow API in $env environment..."
    
    # Helm status
    echo "=== Helm Release Status ==="
    helm status "agentflow-api-$env" -n "$NAMESPACE"
    
    # Deployment status
    echo -e "\n=== Deployment Status ==="
    kubectl get deployment "agentflow-api-$env" -n "$NAMESPACE" -o wide
    
    # Pod status
    echo -e "\n=== Pod Status ==="
    kubectl get pods -n "$NAMESPACE" -l "app.kubernetes.io/name=agentflow-api"
    
    # Service status
    echo -e "\n=== Service Status ==="
    kubectl get svc -n "$NAMESPACE"
    
    # Ingress status
    echo -e "\n=== Ingress Status ==="
    kubectl get ingress -n "$NAMESPACE"
    
    # HPA status
    echo -e "\n=== HPA Status ==="
    kubectl get hpa -n "$NAMESPACE" 2>/dev/null || echo "No HPA found"
}

# Logs function
logs() {
    local env=$1
    local follow=${2:-false}
    
    get_environment_config "$env"
    
    log_info "Showing logs for AgentFlow API in $env environment..."
    
    local kubectl_cmd="kubectl logs -n $NAMESPACE -l app.kubernetes.io/name=agentflow-api --tail=100"
    
    if [[ "$follow" == "true" ]]; then
        kubectl_cmd="$kubectl_cmd -f"
    fi
    
    eval "$kubectl_cmd"
}

# Scale function
scale() {
    local env=$1
    local replicas=$2
    local dry_run=${3:-false}
    
    get_environment_config "$env"
    
    log_info "Scaling AgentFlow API in $env environment to $replicas replicas..."
    
    if [[ "$dry_run" == "true" ]]; then
        log_info "Dry run mode - would execute:"
        echo "kubectl scale deployment agentflow-api-$env --replicas=$replicas -n $NAMESPACE"
    else
        kubectl scale deployment "agentflow-api-$env" --replicas="$replicas" -n "$NAMESPACE"
        
        # Wait for scaling to complete
        kubectl wait --for=condition=available deployment/agentflow-api-$env -n "$NAMESPACE" --timeout=300s
        
        log_success "Scaling completed successfully"
    fi
}

# Restart function
restart() {
    local env=$1
    local dry_run=${2:-false}
    
    get_environment_config "$env"
    
    log_info "Restarting AgentFlow API in $env environment..."
    
    if [[ "$dry_run" == "true" ]]; then
        log_info "Dry run mode - would execute:"
        echo "kubectl rollout restart deployment agentflow-api-$env -n $NAMESPACE"
    else
        kubectl rollout restart deployment "agentflow-api-$env" -n "$NAMESPACE"
        
        # Wait for restart to complete
        kubectl rollout status deployment "agentflow-api-$env" -n "$NAMESPACE" --timeout=300s
        
        log_success "Restart completed successfully"
    fi
}

# Main function
main() {
    local environment=""
    local action=""
    local image_tag="latest"
    local replicas=""
    local dry_run=false
    local follow=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            staging|production)
                environment=$1
                shift
                ;;
            deploy|rollback|status|logs|scale|restart)
                action=$1
                shift
                ;;
            --image-tag)
                image_tag=$2
                shift 2
                ;;
            --replicas)
                replicas=$2
                shift 2
                ;;
            --dry-run)
                dry_run=true
                shift
                ;;
            --follow)
                follow=true
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
    
    # Check prerequisites
    check_prerequisites
    
    # Execute action
    case $action in
        deploy)
            deploy "$environment" "$image_tag" "$dry_run"
            ;;
        rollback)
            rollback "$environment" "$dry_run"
            ;;
        status)
            status "$environment"
            ;;
        logs)
            logs "$environment" "$follow"
            ;;
        scale)
            if [[ -z "$replicas" ]]; then
                log_error "Number of replicas is required for scale action"
                exit 1
            fi
            scale "$environment" "$replicas" "$dry_run"
            ;;
        restart)
            restart "$environment" "$dry_run"
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