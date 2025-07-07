# EESystem Content Curation Platform - Deployment Strategy

## Deployment Overview

The EESystem Content Curation Platform deployment strategy follows modern DevOps practices with containerization, infrastructure as code, automated pipelines, and multi-environment support. The strategy emphasizes security, scalability, and reliability while maintaining rapid deployment capabilities.

## Deployment Architecture

### Multi-Environment Strategy
```
┌─────────────────────────────────────────────────────────────┐
│                Development Environment                      │
│  ├── Local Development (Docker Compose)                   │
│  ├── Feature Branches (Kubernetes Dev)                    │
│  └── Integration Testing                                   │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Staging Environment                         │
│  ├── Pre-production Testing                               │
│  ├── UAT (User Acceptance Testing)                        │
│  ├── Performance Testing                                  │
│  └── Security Testing                                     │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                Production Environment                       │
│  ├── Blue-Green Deployment                                │
│  ├── Canary Releases                                      │
│  ├── Auto-scaling                                         │
│  └── Multi-Region Support                                 │
└─────────────────────────────────────────────────────────────┘
```

### Deployment Environments

#### Development Environment
- **Purpose**: Local development and feature testing
- **Infrastructure**: Docker Compose + Minikube
- **Database**: Local SQLite + AstraDB Sandbox
- **Scaling**: Single instance
- **Monitoring**: Basic logging

#### Staging Environment
- **Purpose**: Pre-production testing and validation
- **Infrastructure**: AWS EKS (smaller cluster)
- **Database**: AstraDB Development + Redis Cluster
- **Scaling**: Limited auto-scaling
- **Monitoring**: Full monitoring stack

#### Production Environment
- **Purpose**: Live system serving end users
- **Infrastructure**: AWS EKS (multi-AZ)
- **Database**: AstraDB Production + Redis Enterprise
- **Scaling**: Full auto-scaling
- **Monitoring**: Complete observability

## Infrastructure as Code (IaC)

### Terraform Configuration

#### Main Infrastructure
```hcl
# terraform/main.tf
terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
  }
  
  backend "s3" {
    bucket         = "eesystem-terraform-state"
    key            = "infrastructure/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "EESystem Content Curation"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# VPC Configuration
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
  
  name = "${var.project_name}-vpc-${var.environment}"
  cidr = var.vpc_cidr
  
  azs             = data.aws_availability_zones.available.names
  private_subnets = var.private_subnet_cidrs
  public_subnets  = var.public_subnet_cidrs
  
  enable_nat_gateway   = true
  enable_vpn_gateway   = false
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  # Kubernetes tags
  public_subnet_tags = {
    "kubernetes.io/role/elb" = "1"
  }
  
  private_subnet_tags = {
    "kubernetes.io/role/internal-elb" = "1"
  }
}

# EKS Cluster
module "eks" {
  source = "terraform-aws-modules/eks/aws"
  
  cluster_name    = "${var.project_name}-cluster-${var.environment}"
  cluster_version = var.kubernetes_version
  
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets
  
  # Cluster endpoint configuration
  cluster_endpoint_private_access = true
  cluster_endpoint_public_access  = true
  cluster_endpoint_public_access_cidrs = var.allowed_cidr_blocks
  
  # Cluster encryption
  cluster_encryption_config = [{
    provider_key_arn = aws_kms_key.eks.arn
    resources        = ["secrets"]
  }]
  
  # EKS Managed Node Groups
  eks_managed_node_groups = {
    general = {
      name = "general-${var.environment}"
      
      instance_types = var.node_instance_types
      min_size       = var.node_group_min_size
      max_size       = var.node_group_max_size
      desired_size   = var.node_group_desired_size
      
      # Use spot instances for cost optimization in non-prod
      capacity_type = var.environment == "production" ? "ON_DEMAND" : "SPOT"
      
      # Node group configuration
      ami_type       = "AL2_x86_64"
      disk_size      = 50
      force_update_version = false
      
      # Kubernetes labels
      k8s_labels = {
        Environment = var.environment
        NodeGroup   = "general"
      }
      
      # Taints for specific workloads
      taints = var.environment == "production" ? [] : [{
        key    = "spot"
        value  = "true"
        effect = "NO_SCHEDULE"
      }]
    }
    
    # Dedicated node group for AI workloads
    ai_workloads = {
      name = "ai-workloads-${var.environment}"
      
      instance_types = ["c5.xlarge", "c5.2xlarge"]
      min_size       = 1
      max_size       = 5
      desired_size   = 2
      
      capacity_type = "ON_DEMAND"
      
      k8s_labels = {
        Environment = var.environment
        NodeGroup   = "ai-workloads"
        Workload    = "ai"
      }
      
      taints = [{
        key    = "ai-workload"
        value  = "true"
        effect = "NO_SCHEDULE"
      }]
    }
  }
  
  # AWS Load Balancer Controller
  enable_irsa = true
  
  tags = {
    Environment = var.environment
  }
}

# KMS Key for EKS encryption
resource "aws_kms_key" "eks" {
  description             = "EKS Secret Encryption Key"
  deletion_window_in_days = 7
  enable_key_rotation     = true
  
  tags = {
    Name = "${var.project_name}-eks-key-${var.environment}"
  }
}

# RDS for metadata (if needed)
resource "aws_db_instance" "metadata" {
  count = var.enable_rds ? 1 : 0
  
  identifier = "${var.project_name}-metadata-${var.environment}"
  
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = var.rds_instance_class
  
  allocated_storage     = var.rds_allocated_storage
  max_allocated_storage = var.rds_max_allocated_storage
  storage_type         = "gp3"
  storage_encrypted    = true
  
  db_name  = "eesystem_metadata"
  username = var.db_username
  password = var.db_password
  
  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
  
  backup_retention_period = var.environment == "production" ? 30 : 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"
  
  skip_final_snapshot       = var.environment != "production"
  final_snapshot_identifier = var.environment == "production" ? "${var.project_name}-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}" : null
  
  tags = {
    Name = "${var.project_name}-metadata-${var.environment}"
  }
}

# ElastiCache Redis Cluster
resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.project_name}-cache-subnet-${var.environment}"
  subnet_ids = module.vpc.private_subnets
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "${var.project_name}-redis-${var.environment}"
  description                = "Redis cluster for EESystem"
  
  port                = 6379
  parameter_group_name = "default.redis7"
  node_type           = var.redis_node_type
  num_cache_clusters  = var.redis_num_nodes
  
  engine_version = "7.0"
  
  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]
  
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = var.redis_auth_token
  
  maintenance_window = "sun:05:00-sun:06:00"
  snapshot_window    = "06:00-07:00"
  snapshot_retention_limit = var.environment == "production" ? 5 : 1
  
  tags = {
    Name = "${var.project_name}-redis-${var.environment}"
  }
}
```

#### Variables Configuration
```hcl
# terraform/variables.tf
variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "eesystem-curation"
}

variable "environment" {
  description = "Environment name"
  type        = string
  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, staging, production."
  }
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
}

variable "kubernetes_version" {
  description = "Kubernetes version"
  type        = string
  default     = "1.28"
}

variable "node_instance_types" {
  description = "Instance types for EKS nodes"
  type        = list(string)
  default     = ["t3.medium", "t3.large"]
}

variable "node_group_min_size" {
  description = "Minimum number of nodes"
  type        = number
  default     = 1
}

variable "node_group_max_size" {
  description = "Maximum number of nodes"
  type        = number
  default     = 10
}

variable "node_group_desired_size" {
  description = "Desired number of nodes"
  type        = number
  default     = 3
}

# Environment-specific variables
variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to access EKS API"
  type        = list(string)
  default     = ["0.0.0.0/0"]  # Restrict in production
}

variable "enable_rds" {
  description = "Whether to create RDS instance"
  type        = bool
  default     = false
}

variable "rds_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "redis_node_type" {
  description = "Redis node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "redis_num_nodes" {
  description = "Number of Redis nodes"
  type        = number
  default     = 2
}
```

#### Environment-Specific Configurations
```hcl
# terraform/environments/production.tfvars
environment = "production"
aws_region  = "us-east-1"

# Network configuration
vpc_cidr = "10.0.0.0/16"
allowed_cidr_blocks = ["203.0.113.0/24"]  # Company IP ranges

# EKS configuration
kubernetes_version = "1.28"
node_instance_types = ["t3.large", "t3.xlarge"]
node_group_min_size = 3
node_group_max_size = 20
node_group_desired_size = 5

# Database configuration
enable_rds = true
rds_instance_class = "db.t3.medium"
rds_allocated_storage = 100
rds_max_allocated_storage = 500

# Redis configuration
redis_node_type = "cache.r6g.large"
redis_num_nodes = 3

# terraform/environments/staging.tfvars
environment = "staging"
aws_region  = "us-east-1"

# Network configuration
vpc_cidr = "10.1.0.0/16"

# EKS configuration
kubernetes_version = "1.28"
node_instance_types = ["t3.medium"]
node_group_min_size = 1
node_group_max_size = 5
node_group_desired_size = 2

# Database configuration
enable_rds = false

# Redis configuration
redis_node_type = "cache.t3.micro"
redis_num_nodes = 1

# terraform/environments/development.tfvars
environment = "development"
aws_region  = "us-east-1"

# Network configuration
vpc_cidr = "10.2.0.0/16"

# EKS configuration
kubernetes_version = "1.28"
node_instance_types = ["t3.small"]
node_group_min_size = 1
node_group_max_size = 3
node_group_desired_size = 1

# Database configuration
enable_rds = false

# Redis configuration
redis_node_type = "cache.t3.micro"
redis_num_nodes = 1
```

## CI/CD Pipeline

### GitHub Actions Workflow
```yaml
# .github/workflows/deploy.yml
name: Deploy EESystem Content Curation Platform

on:
  push:
    branches: [main, develop, staging]
  pull_request:
    branches: [main]

env:
  AWS_REGION: us-east-1
  ECR_REGISTRY: 123456789012.dkr.ecr.us-east-1.amazonaws.com
  EKS_CLUSTER_NAME: eesystem-cluster

jobs:
  test:
    name: Run Tests
    runs-on: ubuntu-latest
    
    services:
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
        cache-dependency-path: frontend/package-lock.json
    
    - name: Setup Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
        cache: 'pip'
        cache-dependency-path: backend/requirements.txt
    
    - name: Install Frontend Dependencies
      run: |
        cd frontend
        npm ci
    
    - name: Install Backend Dependencies
      run: |
        cd backend
        pip install -r requirements.txt
        pip install -r requirements-dev.txt
    
    - name: Run Frontend Tests
      run: |
        cd frontend
        npm run test:ci
        npm run build
    
    - name: Run Backend Tests
      env:
        REDIS_URL: redis://localhost:6379
        DATABASE_URL: sqlite:///test.db
      run: |
        cd backend
        pytest --cov=app --cov-report=xml --cov-report=html
    
    - name: Run Security Scan
      uses: github/super-linter@v5
      env:
        DEFAULT_BRANCH: main
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        VALIDATE_PYTHON: true
        VALIDATE_JAVASCRIPT: true
        VALIDATE_TYPESCRIPT: true
        VALIDATE_DOCKERFILE: true
    
    - name: Upload Coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        files: backend/coverage.xml
        flags: backend
        name: backend-coverage
    
    - name: Archive Test Results
      uses: actions/upload-artifact@v3
      if: always()
      with:
        name: test-results
        path: |
          backend/htmlcov/
          frontend/coverage/

  security:
    name: Security Scan
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Run Trivy vulnerability scanner
      uses: aquasecurity/trivy-action@master
      with:
        scan-type: 'fs'
        scan-ref: '.'
        format: 'sarif'
        output: 'trivy-results.sarif'
    
    - name: Upload Trivy scan results to GitHub Security tab
      uses: github/codeql-action/upload-sarif@v2
      with:
        sarif_file: 'trivy-results.sarif'
    
    - name: Run OWASP Dependency Check
      uses: dependency-check/Dependency-Check_Action@main
      with:
        project: 'EESystem Content Curation Platform'
        path: '.'
        format: 'SARIF'
        out: 'dependency-check-report'
    
    - name: Upload Dependency Check results
      uses: github/codeql-action/upload-sarif@v2
      with:
        sarif_file: dependency-check-report.sarif

  build:
    name: Build and Push Images
    runs-on: ubuntu-latest
    needs: [test, security]
    if: github.event_name == 'push' && (github.ref == 'refs/heads/main' || github.ref == 'refs/heads/develop' || github.ref == 'refs/heads/staging')
    
    outputs:
      frontend-image: ${{ steps.build-frontend.outputs.image }}
      backend-image: ${{ steps.build-backend.outputs.image }}
      ai-services-image: ${{ steps.build-ai-services.outputs.image }}
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: ${{ env.AWS_REGION }}
    
    - name: Login to Amazon ECR
      id: login-ecr
      uses: aws-actions/amazon-ecr-login@v2
    
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3
    
    - name: Build and push Frontend image
      id: build-frontend
      uses: docker/build-push-action@v5
      with:
        context: ./frontend
        platforms: linux/amd64,linux/arm64
        push: true
        tags: |
          ${{ env.ECR_REGISTRY }}/eesystem/frontend:${{ github.sha }}
          ${{ env.ECR_REGISTRY }}/eesystem/frontend:latest
        cache-from: type=gha
        cache-to: type=gha,mode=max
        build-args: |
          BUILDKIT_INLINE_CACHE=1
    
    - name: Build and push Backend image
      id: build-backend
      uses: docker/build-push-action@v5
      with:
        context: ./backend
        platforms: linux/amd64,linux/arm64
        push: true
        tags: |
          ${{ env.ECR_REGISTRY }}/eesystem/backend:${{ github.sha }}
          ${{ env.ECR_REGISTRY }}/eesystem/backend:latest
        cache-from: type=gha
        cache-to: type=gha,mode=max
    
    - name: Build and push AI Services image
      id: build-ai-services
      uses: docker/build-push-action@v5
      with:
        context: ./ai-services
        platforms: linux/amd64,linux/arm64
        push: true
        tags: |
          ${{ env.ECR_REGISTRY }}/eesystem/ai-services:${{ github.sha }}
          ${{ env.ECR_REGISTRY }}/eesystem/ai-services:latest
        cache-from: type=gha
        cache-to: type=gha,mode=max
    
    - name: Scan images for vulnerabilities
      run: |
        # Scan frontend image
        aws ecr describe-image-scan-findings \
          --repository-name eesystem/frontend \
          --image-id imageTag=${{ github.sha }} \
          --region ${{ env.AWS_REGION }} || true
        
        # Scan backend image
        aws ecr describe-image-scan-findings \
          --repository-name eesystem/backend \
          --image-id imageTag=${{ github.sha }} \
          --region ${{ env.AWS_REGION }} || true

  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/develop' || github.ref == 'refs/heads/staging'
    environment: staging
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: ${{ env.AWS_REGION }}
    
    - name: Setup kubectl
      uses: azure/setup-kubectl@v3
      with:
        version: 'v1.28.0'
    
    - name: Setup Helm
      uses: azure/setup-helm@v3
      with:
        version: 'v3.12.0'
    
    - name: Update kubeconfig
      run: |
        aws eks update-kubeconfig --region ${{ env.AWS_REGION }} --name eesystem-cluster-staging
    
    - name: Deploy with Helm
      run: |
        helm upgrade --install eesystem-staging ./helm/eesystem \
          --namespace eesystem-staging \
          --create-namespace \
          --values ./helm/eesystem/values-staging.yaml \
          --set frontend.image.tag=${{ github.sha }} \
          --set backend.image.tag=${{ github.sha }} \
          --set aiServices.image.tag=${{ github.sha }} \
          --wait \
          --timeout=10m
    
    - name: Run Smoke Tests
      run: |
        # Wait for deployment to be ready
        kubectl wait --for=condition=available --timeout=300s deployment/frontend -n eesystem-staging
        kubectl wait --for=condition=available --timeout=300s deployment/backend -n eesystem-staging
        kubectl wait --for=condition=available --timeout=300s deployment/ai-services -n eesystem-staging
        
        # Run smoke tests
        curl -f https://staging.eesystem-curation.com/api/v1/health
        curl -f https://staging.eesystem-curation.com

  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    environment: production
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: ${{ env.AWS_REGION }}
    
    - name: Setup kubectl
      uses: azure/setup-kubectl@v3
      with:
        version: 'v1.28.0'
    
    - name: Setup Helm
      uses: azure/setup-helm@v3
      with:
        version: 'v3.12.0'
    
    - name: Update kubeconfig
      run: |
        aws eks update-kubeconfig --region ${{ env.AWS_REGION }} --name eesystem-cluster-production
    
    - name: Create backup before deployment
      run: |
        # Backup current deployment
        helm get values eesystem-production -n eesystem-production > backup-values.yaml || true
        kubectl get all -n eesystem-production -o yaml > backup-resources.yaml || true
        
        # Upload backup to S3
        aws s3 cp backup-values.yaml s3://eesystem-backups/deployments/$(date +%Y%m%d-%H%M%S)/
        aws s3 cp backup-resources.yaml s3://eesystem-backups/deployments/$(date +%Y%m%d-%H%M%S)/
    
    - name: Deploy with Blue-Green Strategy
      run: |
        # Deploy to green environment
        helm upgrade --install eesystem-green ./helm/eesystem \
          --namespace eesystem-production \
          --create-namespace \
          --values ./helm/eesystem/values-production.yaml \
          --set frontend.image.tag=${{ github.sha }} \
          --set backend.image.tag=${{ github.sha }} \
          --set aiServices.image.tag=${{ github.sha }} \
          --set deployment.suffix=green \
          --wait \
          --timeout=15m
    
    - name: Run Production Health Checks
      run: |
        # Wait for green deployment
        kubectl wait --for=condition=available --timeout=600s deployment/frontend-green -n eesystem-production
        kubectl wait --for=condition=available --timeout=600s deployment/backend-green -n eesystem-production
        
        # Run comprehensive health checks
        ./scripts/production-health-check.sh eesystem-production green
    
    - name: Switch Traffic to Green
      run: |
        # Update service selectors to point to green deployment
        kubectl patch service frontend-service -n eesystem-production -p '{"spec":{"selector":{"version":"green"}}}'
        kubectl patch service backend-service -n eesystem-production -p '{"spec":{"selector":{"version":"green"}}}'
        
        # Wait and verify traffic switch
        sleep 30
        curl -f https://eesystem-curation.com/api/v1/health
    
    - name: Cleanup Blue Deployment
      run: |
        # Remove blue deployment after successful green deployment
        kubectl delete deployment frontend-blue backend-blue ai-services-blue -n eesystem-production --ignore-not-found=true
    
    - name: Notify Deployment Success
      uses: 8398a7/action-slack@v3
      with:
        status: success
        channel: '#deployments'
        text: '🚀 Production deployment successful! Version: ${{ github.sha }}'
      env:
        SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}

  rollback:
    name: Rollback Production
    runs-on: ubuntu-latest
    if: failure() && github.ref == 'refs/heads/main'
    needs: deploy-production
    environment: production
    
    steps:
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: ${{ env.AWS_REGION }}
    
    - name: Setup kubectl
      uses: azure/setup-kubectl@v3
      with:
        version: 'v1.28.0'
    
    - name: Setup Helm
      uses: azure/setup-helm@v3
      with:
        version: 'v3.12.0'
    
    - name: Update kubeconfig
      run: |
        aws eks update-kubeconfig --region ${{ env.AWS_REGION }} --name eesystem-cluster-production
    
    - name: Rollback to Previous Version
      run: |
        # Rollback using Helm
        helm rollback eesystem-production -n eesystem-production
        
        # Wait for rollback to complete
        kubectl rollout status deployment/frontend -n eesystem-production
        kubectl rollout status deployment/backend -n eesystem-production
    
    - name: Verify Rollback
      run: |
        # Run health checks on rolled back version
        ./scripts/production-health-check.sh eesystem-production
    
    - name: Notify Rollback
      uses: 8398a7/action-slack@v3
      with:
        status: custom
        custom_payload: |
          {
            channel: '#deployments',
            attachments: [{
              color: 'warning',
              title: '⚠️ Production Rollback Executed',
              text: 'Deployment failed and has been rolled back to previous version.',
              fields: [{
                title: 'Commit',
                value: '${{ github.sha }}',
                short: true
              }]
            }]
          }
      env:
        SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

## Helm Charts

### Main Chart Configuration
```yaml
# helm/eesystem/Chart.yaml
apiVersion: v2
name: eesystem
description: EESystem Content Curation Platform
type: application
version: 1.0.0
appVersion: "1.0.0"

dependencies:
  - name: redis
    version: 18.1.5
    repository: https://charts.bitnami.com/bitnami
    condition: redis.enabled
  
  - name: nginx-ingress
    version: 4.8.3
    repository: https://kubernetes.github.io/ingress-nginx
    condition: ingress.enabled
  
  - name: cert-manager
    version: 1.13.1
    repository: https://charts.jetstack.io
    condition: certManager.enabled
```

### Values Configuration
```yaml
# helm/eesystem/values.yaml
# Global configuration
global:
  imageRegistry: "123456789012.dkr.ecr.us-east-1.amazonaws.com"
  imagePullPolicy: IfNotPresent
  storageClass: "gp3"

# Frontend configuration
frontend:
  enabled: true
  replicaCount: 3
  image:
    repository: eesystem/frontend
    tag: "latest"
  
  service:
    type: ClusterIP
    port: 80
    targetPort: 3000
  
  resources:
    requests:
      memory: "256Mi"
      cpu: "250m"
    limits:
      memory: "512Mi"
      cpu: "500m"
  
  autoscaling:
    enabled: true
    minReplicas: 3
    maxReplicas: 10
    targetCPUUtilizationPercentage: 70
    targetMemoryUtilizationPercentage: 80
  
  nodeSelector:
    kubernetes.io/arch: amd64
  
  tolerations: []
  
  affinity:
    podAntiAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchExpressions:
            - key: app.kubernetes.io/name
              operator: In
              values:
              - frontend
          topologyKey: kubernetes.io/hostname

# Backend API configuration
backend:
  enabled: true
  replicaCount: 5
  image:
    repository: eesystem/backend
    tag: "latest"
  
  service:
    type: ClusterIP
    port: 80
    targetPort: 8000
  
  resources:
    requests:
      memory: "512Mi"
      cpu: "500m"
    limits:
      memory: "1Gi"
      cpu: "1000m"
  
  autoscaling:
    enabled: true
    minReplicas: 3
    maxReplicas: 20
    targetCPUUtilizationPercentage: 70
    targetMemoryUtilizationPercentage: 80
    behavior:
      scaleDown:
        stabilizationWindowSeconds: 300
        policies:
        - type: Percent
          value: 50
          periodSeconds: 60
      scaleUp:
        stabilizationWindowSeconds: 60
        policies:
        - type: Percent
          value: 100
          periodSeconds: 60
  
  # Environment variables
  env:
    - name: DATABASE_URL
      valueFrom:
        secretKeyRef:
          name: eesystem-secrets
          key: database-url
    - name: REDIS_URL
      valueFrom:
        secretKeyRef:
          name: eesystem-secrets
          key: redis-url
    - name: ASTRA_DB_TOKEN
      valueFrom:
        secretKeyRef:
          name: eesystem-secrets
          key: astra-db-token
  
  # Health checks
  livenessProbe:
    httpGet:
      path: /api/v1/health
      port: 8000
    initialDelaySeconds: 45
    periodSeconds: 15
    timeoutSeconds: 5
    failureThreshold: 3
  
  readinessProbe:
    httpGet:
      path: /api/v1/health
      port: 8000
    initialDelaySeconds: 15
    periodSeconds: 5
    timeoutSeconds: 3
    failureThreshold: 3

# AI Services configuration
aiServices:
  enabled: true
  replicaCount: 3
  image:
    repository: eesystem/ai-services
    tag: "latest"
  
  service:
    type: ClusterIP
    port: 80
    targetPort: 8001
  
  resources:
    requests:
      memory: "1Gi"
      cpu: "1000m"
    limits:
      memory: "2Gi"
      cpu: "2000m"
  
  autoscaling:
    enabled: true
    minReplicas: 2
    maxReplicas: 10
    targetCPUUtilizationPercentage: 60
    targetMemoryUtilizationPercentage: 70
  
  # Node selector for AI workloads
  nodeSelector:
    workload: ai
  
  tolerations:
  - key: "ai-workload"
    operator: "Equal"
    value: "true"
    effect: "NoSchedule"
  
  env:
    - name: OPENAI_API_KEY
      valueFrom:
        secretKeyRef:
          name: ai-secrets
          key: openai-api-key
    - name: ANTHROPIC_API_KEY
      valueFrom:
        secretKeyRef:
          name: ai-secrets
          key: anthropic-api-key

# Worker configuration (Celery)
workers:
  enabled: true
  replicaCount: 5
  image:
    repository: eesystem/backend
    tag: "latest"
  
  command: ["celery", "worker", "-A", "app.worker", "--loglevel=info"]
  
  resources:
    requests:
      memory: "512Mi"
      cpu: "500m"
    limits:
      memory: "1Gi"
      cpu: "1000m"
  
  autoscaling:
    enabled: true
    minReplicas: 3
    maxReplicas: 15
    targetCPUUtilizationPercentage: 70

# Ingress configuration
ingress:
  enabled: true
  className: "nginx"
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
  
  hosts:
    - host: eesystem-curation.com
      paths:
        - path: /
          pathType: Prefix
          service:
            name: frontend
            port: 80
    - host: api.eesystem-curation.com
      paths:
        - path: /
          pathType: Prefix
          service:
            name: backend
            port: 80
  
  tls:
    - secretName: eesystem-tls
      hosts:
        - eesystem-curation.com
        - api.eesystem-curation.com

# Redis configuration
redis:
  enabled: true
  auth:
    enabled: true
    password: "your-redis-password"
  
  master:
    persistence:
      enabled: true
      size: 8Gi
      storageClass: "gp3"
  
  replica:
    replicaCount: 2
    persistence:
      enabled: true
      size: 8Gi
      storageClass: "gp3"

# Monitoring configuration
monitoring:
  enabled: true
  prometheus:
    enabled: true
  grafana:
    enabled: true
  
  serviceMonitor:
    enabled: true
    interval: 30s
    path: /metrics

# Security configuration
podSecurityPolicy:
  enabled: true

networkPolicy:
  enabled: true
  policyTypes:
    - Ingress
    - Egress

# Resource quotas
resourceQuota:
  enabled: true
  hard:
    requests.cpu: "50"
    requests.memory: "100Gi"
    limits.cpu: "100"
    limits.memory: "200Gi"
    persistentvolumeclaims: "20"
```

### Environment-Specific Values
```yaml
# helm/eesystem/values-production.yaml
# Production-specific overrides
frontend:
  replicaCount: 5
  resources:
    requests:
      memory: "512Mi"
      cpu: "500m"
    limits:
      memory: "1Gi"
      cpu: "1000m"
  
  autoscaling:
    minReplicas: 5
    maxReplicas: 20

backend:
  replicaCount: 8
  resources:
    requests:
      memory: "1Gi"
      cpu: "1000m"
    limits:
      memory: "2Gi"
      cpu: "2000m"
  
  autoscaling:
    minReplicas: 5
    maxReplicas: 30

aiServices:
  replicaCount: 5
  resources:
    requests:
      memory: "2Gi"
      cpu: "2000m"
    limits:
      memory: "4Gi"
      cpu: "4000m"
  
  autoscaling:
    minReplicas: 3
    maxReplicas: 15

workers:
  replicaCount: 10
  autoscaling:
    minReplicas: 5
    maxReplicas: 25

redis:
  master:
    persistence:
      size: 20Gi
  replica:
    replicaCount: 3
    persistence:
      size: 20Gi

# Production ingress with multiple domains
ingress:
  hosts:
    - host: eesystem-curation.com
      paths:
        - path: /
          pathType: Prefix
          service:
            name: frontend
            port: 80
    - host: www.eesystem-curation.com
      paths:
        - path: /
          pathType: Prefix
          service:
            name: frontend
            port: 80
    - host: api.eesystem-curation.com
      paths:
        - path: /
          pathType: Prefix
          service:
            name: backend
            port: 80
```

## Deployment Scripts

### Production Health Check Script
```bash
#!/bin/bash
# scripts/production-health-check.sh

set -e

NAMESPACE=${1:-eesystem-production}
DEPLOYMENT_SUFFIX=${2:-""}

if [ ! -z "$DEPLOYMENT_SUFFIX" ]; then
    DEPLOYMENT_SUFFIX="-${DEPLOYMENT_SUFFIX}"
fi

echo "Running production health checks for namespace: $NAMESPACE"

# Function to check pod health
check_pod_health() {
    local deployment=$1
    echo "Checking $deployment health..."
    
    # Check if deployment exists and is ready
    kubectl get deployment "${deployment}${DEPLOYMENT_SUFFIX}" -n $NAMESPACE
    kubectl wait --for=condition=available --timeout=300s deployment/"${deployment}${DEPLOYMENT_SUFFIX}" -n $NAMESPACE
    
    # Check pod logs for errors
    local pods=$(kubectl get pods -n $NAMESPACE -l app="${deployment}" --field-selector=status.phase=Running -o name)
    for pod in $pods; do
        echo "Checking logs for $pod..."
        kubectl logs $pod -n $NAMESPACE --tail=50 | grep -i error || true
    done
}

# Function to check service endpoints
check_service_endpoints() {
    echo "Checking service endpoints..."
    
    # Check frontend endpoint
    kubectl get service frontend-service -n $NAMESPACE
    
    # Check backend API endpoint
    kubectl get service backend-service -n $NAMESPACE
    
    # Check AI services endpoint
    kubectl get service ai-services-service -n $NAMESPACE
}

# Function to run API health checks
check_api_health() {
    echo "Running API health checks..."
    
    # Get cluster IP for backend service
    BACKEND_IP=$(kubectl get service backend-service -n $NAMESPACE -o jsonpath='{.spec.clusterIP}')
    
    # Port forward for testing
    kubectl port-forward service/backend-service 8080:80 -n $NAMESPACE &
    PORT_FORWARD_PID=$!
    
    sleep 10
    
    # Test health endpoint
    if curl -f http://localhost:8080/api/v1/health; then
        echo "✅ Backend health check passed"
    else
        echo "❌ Backend health check failed"
        kill $PORT_FORWARD_PID
        exit 1
    fi
    
    # Test metrics endpoint
    if curl -f http://localhost:8080/api/v1/metrics; then
        echo "✅ Metrics endpoint accessible"
    else
        echo "⚠️  Metrics endpoint not accessible"
    fi
    
    kill $PORT_FORWARD_PID
}

# Function to check database connectivity
check_database_connectivity() {
    echo "Checking database connectivity..."
    
    # Run database connectivity test
    kubectl run db-test --image=eesystem/backend:latest --rm -i --restart=Never -n $NAMESPACE -- python -c "
import asyncio
from app.core.database import test_connection

async def test():
    try:
        await test_connection()
        print('✅ Database connection successful')
    except Exception as e:
        print(f'❌ Database connection failed: {e}')
        exit(1)

asyncio.run(test())
"
}

# Function to check resource utilization
check_resource_utilization() {
    echo "Checking resource utilization..."
    
    # Check pod resource usage
    kubectl top pods -n $NAMESPACE
    
    # Check node resource usage
    kubectl top nodes
    
    # Check for any pods in error state
    error_pods=$(kubectl get pods -n $NAMESPACE --field-selector=status.phase!=Running,status.phase!=Succeeded -o name)
    if [ ! -z "$error_pods" ]; then
        echo "⚠️  Found pods in error state:"
        echo "$error_pods"
    else
        echo "✅ All pods are in running state"
    fi
}

# Run all health checks
echo "🏥 Starting comprehensive health checks..."

check_pod_health "frontend"
check_pod_health "backend"
check_pod_health "ai-services"
check_service_endpoints
check_api_health
check_database_connectivity
check_resource_utilization

echo "🎉 All health checks completed successfully!"
```

### Deployment Rollback Script
```bash
#!/bin/bash
# scripts/rollback-deployment.sh

set -e

NAMESPACE=${1:-eesystem-production}
RELEASE_NAME=${2:-eesystem-production}

echo "Rolling back deployment in namespace: $NAMESPACE"

# Get current revision
CURRENT_REVISION=$(helm list -n $NAMESPACE -o json | jq -r ".[] | select(.name==\"$RELEASE_NAME\") | .revision")
echo "Current revision: $CURRENT_REVISION"

# Get previous revision
PREVIOUS_REVISION=$((CURRENT_REVISION - 1))
echo "Rolling back to revision: $PREVIOUS_REVISION"

# Confirm rollback
read -p "Are you sure you want to rollback to revision $PREVIOUS_REVISION? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Rollback cancelled"
    exit 1
fi

# Perform rollback
echo "Performing rollback..."
helm rollback $RELEASE_NAME $PREVIOUS_REVISION -n $NAMESPACE

# Wait for rollout to complete
echo "Waiting for rollout to complete..."
kubectl rollout status deployment/frontend -n $NAMESPACE --timeout=300s
kubectl rollout status deployment/backend -n $NAMESPACE --timeout=300s
kubectl rollout status deployment/ai-services -n $NAMESPACE --timeout=300s

# Run health checks
echo "Running post-rollback health checks..."
./scripts/production-health-check.sh $NAMESPACE

echo "✅ Rollback completed successfully!"
```

This comprehensive deployment strategy provides a robust, scalable, and secure foundation for deploying the EESystem Content Curation Platform across multiple environments with automated testing, security scanning, and monitoring capabilities.