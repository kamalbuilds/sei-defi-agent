# NEXUS AI DeFi Platform - Terraform Infrastructure
terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.0"
    }
  }
  
  backend "s3" {
    # Configure via CLI or environment variables
  }
}

# Variables
variable "environment" {
  description = "Environment name"
  type        = string
  default     = "staging"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-west-2"
}

variable "cluster_name" {
  description = "EKS cluster name"
  type        = string
  default     = "nexus-ai-defi"
}

variable "image_tag" {
  description = "Docker image tag"
  type        = string
  default     = "latest"
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = ""
}

# Local values
locals {
  name_prefix = "${var.cluster_name}-${var.environment}"
  
  common_tags = {
    Project     = "NEXUS AI DeFi"
    Environment = var.environment
    ManagedBy   = "Terraform"
    Owner       = "DevOps"
  }
}

# Data sources
data "aws_availability_zones" "available" {
  state = "available"
}

# VPC Configuration
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "${local.name_prefix}-vpc"
  cidr = "10.0.0.0/16"

  azs             = slice(data.aws_availability_zones.available.names, 0, 3)
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway     = true
  single_nat_gateway     = var.environment == "development"
  enable_vpn_gateway     = false
  enable_dns_hostnames   = true
  enable_dns_support     = true

  tags = merge(local.common_tags, {
    "kubernetes.io/cluster/${local.name_prefix}" = "shared"
  })

  public_subnet_tags = {
    "kubernetes.io/cluster/${local.name_prefix}" = "shared"
    "kubernetes.io/role/elb"                     = 1
  }

  private_subnet_tags = {
    "kubernetes.io/cluster/${local.name_prefix}" = "shared"
    "kubernetes.io/role/internal-elb"            = 1
  }
}

# EKS Cluster
module "eks" {
  source = "terraform-aws-modules/eks/aws"
  version = "~> 19.0"

  cluster_name    = local.name_prefix
  cluster_version = "1.28"

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  cluster_endpoint_public_access  = true
  cluster_endpoint_private_access = true
  cluster_endpoint_public_access_cidrs = ["0.0.0.0/0"]

  # Encryption
  cluster_encryption_config = [
    {
      provider_key_arn = aws_kms_key.eks.arn
      resources        = ["secrets"]
    }
  ]

  # Add-ons
  cluster_addons = {
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent = true
    }
    aws-ebs-csi-driver = {
      most_recent = true
    }
  }

  # EKS Managed Node Groups
  eks_managed_node_groups = {
    general = {
      name = "${local.name_prefix}-general"

      instance_types = ["m5.large", "m5.xlarge"]
      capacity_type  = "ON_DEMAND"

      min_size     = 2
      max_size     = 10
      desired_size = var.environment == "production" ? 6 : 3

      ami_type = "AL2_x86_64"
      
      block_device_mappings = {
        xvda = {
          device_name = "/dev/xvda"
          ebs = {
            volume_size           = 100
            volume_type          = "gp3"
            delete_on_termination = true
            encrypted            = true
          }
        }
      }

      tags = local.common_tags
    }

    spot = {
      name = "${local.name_prefix}-spot"

      instance_types = ["m5.large", "m5.xlarge", "m4.large"]
      capacity_type  = "SPOT"

      min_size     = 0
      max_size     = 5
      desired_size = var.environment == "production" ? 2 : 1

      ami_type = "AL2_x86_64"
      
      block_device_mappings = {
        xvda = {
          device_name = "/dev/xvda"
          ebs = {
            volume_size           = 80
            volume_type          = "gp3"
            delete_on_termination = true
            encrypted            = true
          }
        }
      }

      tags = merge(local.common_tags, {
        "k8s.io/cluster-autoscaler/enabled" = "true"
        "k8s.io/cluster-autoscaler/${local.name_prefix}" = "owned"
      })
    }
  }

  tags = local.common_tags
}

# KMS Key for EKS
resource "aws_kms_key" "eks" {
  description             = "EKS Secret Encryption Key for ${local.name_prefix}"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-eks-encryption-key"
  })
}

resource "aws_kms_alias" "eks" {
  name          = "alias/${local.name_prefix}-eks"
  target_key_id = aws_kms_key.eks.key_id
}

# RDS Instance for PostgreSQL
resource "aws_db_subnet_group" "main" {
  name       = "${local.name_prefix}-db-subnet-group"
  subnet_ids = module.vpc.private_subnets

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-db-subnet-group"
  })
}

resource "aws_security_group" "rds" {
  name_prefix = "${local.name_prefix}-rds-"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [module.eks.node_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-rds-sg"
  })
}

resource "aws_db_parameter_group" "postgres" {
  family = "postgres16"
  name   = "${local.name_prefix}-postgres16"

  parameter {
    name  = "log_statement"
    value = "all"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  tags = local.common_tags
}

resource "aws_db_instance" "postgres" {
  identifier = "${local.name_prefix}-postgres"

  engine         = "postgres"
  engine_version = "16.3"
  instance_class = var.environment == "production" ? "db.r5.xlarge" : "db.t3.medium"

  allocated_storage     = var.environment == "production" ? 200 : 50
  max_allocated_storage = var.environment == "production" ? 1000 : 200
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id           = aws_kms_key.rds.arn

  db_name  = "nexus_defi"
  username = "nexus_admin"
  password = random_password.db_password.result

  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
  parameter_group_name   = aws_db_parameter_group.postgres.name

  backup_retention_period = var.environment == "production" ? 30 : 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"

  monitoring_interval = var.environment == "production" ? 60 : 0
  monitoring_role_arn = var.environment == "production" ? aws_iam_role.rds_enhanced_monitoring[0].arn : null

  performance_insights_enabled = var.environment == "production"
  performance_insights_retention_period = var.environment == "production" ? 7 : null

  deletion_protection = var.environment == "production"
  skip_final_snapshot = var.environment != "production"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-postgres"
  })
}

# KMS Key for RDS
resource "aws_kms_key" "rds" {
  description             = "RDS Encryption Key for ${local.name_prefix}"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-rds-encryption-key"
  })
}

resource "aws_kms_alias" "rds" {
  name          = "alias/${local.name_prefix}-rds"
  target_key_id = aws_kms_key.rds.key_id
}

# RDS Enhanced Monitoring Role
resource "aws_iam_role" "rds_enhanced_monitoring" {
  count = var.environment == "production" ? 1 : 0
  name  = "${local.name_prefix}-rds-enhanced-monitoring"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "rds_enhanced_monitoring" {
  count      = var.environment == "production" ? 1 : 0
  role       = aws_iam_role.rds_enhanced_monitoring[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# Random password for database
resource "random_password" "db_password" {
  length  = 32
  special = true
}

# ElastiCache Redis Cluster
resource "aws_elasticache_subnet_group" "redis" {
  name       = "${local.name_prefix}-redis-subnet-group"
  subnet_ids = module.vpc.private_subnets

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-redis-subnet-group"
  })
}

resource "aws_security_group" "redis" {
  name_prefix = "${local.name_prefix}-redis-"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [module.eks.node_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-redis-sg"
  })
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "${local.name_prefix}-redis"
  description               = "Redis cluster for NEXUS AI DeFi ${var.environment}"

  port               = 6379
  parameter_group_name = "default.redis7"
  node_type          = var.environment == "production" ? "cache.m6g.large" : "cache.t3.micro"
  
  num_cache_clusters = var.environment == "production" ? 3 : 1
  
  engine_version     = "7.0"
  subnet_group_name  = aws_elasticache_subnet_group.redis.name
  security_group_ids = [aws_security_group.redis.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = random_password.redis_password.result

  maintenance_window = "sun:03:00-sun:05:00"
  snapshot_retention_limit = var.environment == "production" ? 5 : 1
  snapshot_window         = "02:00-03:00"

  automatic_failover_enabled = var.environment == "production"
  multi_az_enabled          = var.environment == "production"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-redis"
  })
}

resource "random_password" "redis_password" {
  length  = 32
  special = false # Redis auth tokens don't support all special characters
}

# S3 Bucket for application assets
resource "aws_s3_bucket" "assets" {
  bucket = "${local.name_prefix}-assets-${random_id.bucket_suffix.hex}"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-assets"
  })
}

resource "random_id" "bucket_suffix" {
  byte_length = 4
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket = aws_s3_bucket.assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "assets" {
  bucket = aws_s3_bucket.assets.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Application Load Balancer
resource "aws_security_group" "alb" {
  name_prefix = "${local.name_prefix}-alb-"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-alb-sg"
  })
}

# Outputs
output "cluster_endpoint" {
  description = "Endpoint for EKS control plane"
  value       = module.eks.cluster_endpoint
}

output "cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "cluster_security_group_id" {
  description = "Security group ID attached to the EKS cluster"
  value       = module.eks.cluster_security_group_id
}

output "database_endpoint" {
  description = "RDS instance endpoint"
  value       = aws_db_instance.postgres.endpoint
  sensitive   = true
}

output "database_password" {
  description = "Database password"
  value       = random_password.db_password.result
  sensitive   = true
}

output "redis_endpoint" {
  description = "Redis cluster endpoint"
  value       = aws_elasticache_replication_group.redis.configuration_endpoint_address
  sensitive   = true
}

output "redis_password" {
  description = "Redis password"
  value       = random_password.redis_password.result
  sensitive   = true
}

output "s3_bucket" {
  description = "S3 bucket name"
  value       = aws_s3_bucket.assets.bucket
}

output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}