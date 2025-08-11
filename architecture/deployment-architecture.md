# Deployment Architecture

## Overview
The Deployment Architecture defines the infrastructure, containerization, orchestration, and operational strategies for deploying and managing the NEXUS AI DeFi platform in production environments.

## Infrastructure Architecture

### 1. Multi-Cloud Deployment Strategy
```yaml
# Production Infrastructure Configuration
apiVersion: v1
kind: ConfigMap
metadata:
  name: nexus-infrastructure-config
data:
  PRIMARY_CLOUD: "aws"
  SECONDARY_CLOUD: "gcp"
  TERTIARY_CLOUD: "azure"
  REGIONS: |
    primary:
      - us-west-2
      - us-east-1
    secondary:
      - us-central1
      - europe-west1
    tertiary:
      - eastus
      - westeurope
  DISASTER_RECOVERY_ENABLED: "true"
  AUTO_FAILOVER_ENABLED: "true"
```

### 2. Kubernetes Cluster Configuration
```yaml
# Production Kubernetes Configuration
apiVersion: v1
kind: Cluster
metadata:
  name: nexus-production-cluster
spec:
  nodeGroups:
    - name: system-nodes
      instanceType: t3.large
      minSize: 3
      maxSize: 10
      desiredCapacity: 5
      labels:
        workload-type: system
    - name: agent-nodes
      instanceType: c5.2xlarge
      minSize: 5
      maxSize: 50
      desiredCapacity: 10
      labels:
        workload-type: agents
    - name: data-nodes
      instanceType: r5.xlarge
      minSize: 3
      maxSize: 15
      desiredCapacity: 6
      labels:
        workload-type: data-intensive
  addons:
    - aws-load-balancer-controller
    - cluster-autoscaler
    - aws-ebs-csi-driver
    - vpc-cni
    - coredns
    - kube-proxy
```

### 3. Agent Deployment Manifests
```yaml
# Agent Orchestrator Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agent-orchestrator
  namespace: nexus-agents
spec:
  replicas: 3
  selector:
    matchLabels:
      app: agent-orchestrator
  template:
    metadata:
      labels:
        app: agent-orchestrator
    spec:
      containers:
      - name: orchestrator
        image: nexus/agent-orchestrator:v1.0.0
        ports:
        - containerPort: 8080
        - containerPort: 9090
        env:
        - name: REDIS_URL
          value: "redis://redis-cluster:6379"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: url
        - name: SEI_RPC_URL
          value: "https://rpc.sei-apis.com"
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: agent-orchestrator-service
  namespace: nexus-agents
spec:
  selector:
    app: agent-orchestrator
  ports:
    - name: http
      protocol: TCP
      port: 80
      targetPort: 8080
    - name: metrics
      protocol: TCP
      port: 9090
      targetPort: 9090
  type: ClusterIP
```

```yaml
# Portfolio Manager Agent Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: portfolio-manager-agents
  namespace: nexus-agents
spec:
  replicas: 5
  selector:
    matchLabels:
      app: portfolio-manager
      agent-type: portfolio
  template:
    metadata:
      labels:
        app: portfolio-manager
        agent-type: portfolio
    spec:
      containers:
      - name: portfolio-agent
        image: nexus/portfolio-manager:v1.0.0
        env:
        - name: AGENT_TYPE
          value: "PORTFOLIO_MANAGER"
        - name: ORCHESTRATOR_URL
          value: "http://agent-orchestrator-service:80"
        - name: REDIS_URL
          value: "redis://redis-cluster:6379"
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        volumeMounts:
        - name: agent-config
          mountPath: /config
        - name: agent-secrets
          mountPath: /secrets
          readOnly: true
      volumes:
      - name: agent-config
        configMap:
          name: portfolio-agent-config
      - name: agent-secrets
        secret:
          secretName: agent-secrets
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: portfolio-manager-hpa
  namespace: nexus-agents
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: portfolio-manager-agents
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### 4. Data Layer Deployment
```yaml
# Redis Cluster Configuration
apiVersion: redis.redis.opstreelabs.in/v1beta1
kind: RedisCluster
metadata:
  name: redis-cluster
  namespace: nexus-data
spec:
  clusterSize: 6
  kubernetesConfig:
    image: redis:7.0.5
    imagePullPolicy: IfNotPresent
    resources:
      requests:
        cpu: 100m
        memory: 128Mi
      limits:
        cpu: 1
        memory: 1Gi
    redisSecret:
      name: redis-secret
      key: password
  storage:
    volumeClaimTemplate:
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 100Gi
        storageClassName: gp3
  securityContext:
    runAsUser: 1000
    fsGroup: 1000
---
# PostgreSQL Deployment
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: postgresql-cluster
  namespace: nexus-data
spec:
  instances: 3
  primaryUpdateStrategy: unsupervised
  postgresql:
    parameters:
      max_connections: "200"
      shared_buffers: "256MB"
      effective_cache_size: "1GB"
      work_mem: "4MB"
      maintenance_work_mem: "64MB"
      random_page_cost: "1.1"
      effective_io_concurrency: "200"
      max_worker_processes: "8"
      max_parallel_workers: "4"
      max_parallel_workers_per_gather: "2"
  
  bootstrap:
    initdb:
      database: nexus
      owner: nexus_user
      secret:
        name: postgresql-secret
  
  storage:
    size: 500Gi
    storageClass: gp3
  
  monitoring:
    enabled: true
    
  backup:
    retentionPolicy: "30d"
    barmanObjectStore:
      s3Credentials:
        accessKeyId:
          name: backup-secret
          key: ACCESS_KEY_ID
        secretAccessKey:
          name: backup-secret
          key: SECRET_ACCESS_KEY
      wal:
        retention: "7d"
      data:
        retention: "30d"
      destinationPath: s3://nexus-backups/postgresql
```

### 5. Monitoring and Observability Stack
```yaml
# Prometheus Configuration
apiVersion: monitoring.coreos.com/v1
kind: Prometheus
metadata:
  name: nexus-prometheus
  namespace: monitoring
spec:
  serviceAccountName: prometheus
  replicas: 2
  retention: 30d
  storage:
    volumeClaimTemplate:
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 1Ti
        storageClassName: gp3
  
  serviceMonitorSelector:
    matchLabels:
      team: nexus
  
  ruleSelector:
    matchLabels:
      team: nexus
  
  resources:
    requests:
      memory: 2Gi
      cpu: 1
    limits:
      memory: 4Gi
      cpu: 2
---
# Grafana Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: grafana
  namespace: monitoring
spec:
  replicas: 2
  selector:
    matchLabels:
      app: grafana
  template:
    metadata:
      labels:
        app: grafana
    spec:
      containers:
      - name: grafana
        image: grafana/grafana:10.0.0
        ports:
        - containerPort: 3000
        env:
        - name: GF_SECURITY_ADMIN_PASSWORD
          valueFrom:
            secretKeyRef:
              name: grafana-secret
              key: admin-password
        - name: GF_DATABASE_TYPE
          value: postgres
        - name: GF_DATABASE_HOST
          value: postgresql-cluster-rw:5432
        - name: GF_DATABASE_NAME
          value: grafana
        volumeMounts:
        - name: grafana-storage
          mountPath: /var/lib/grafana
        - name: grafana-dashboards
          mountPath: /etc/grafana/provisioning/dashboards
        - name: grafana-datasources
          mountPath: /etc/grafana/provisioning/datasources
      volumes:
      - name: grafana-storage
        persistentVolumeClaim:
          claimName: grafana-pvc
      - name: grafana-dashboards
        configMap:
          name: grafana-dashboards
      - name: grafana-datasources
        configMap:
          name: grafana-datasources
```

## Docker Containerization

### 1. Multi-Stage Dockerfile for Agent Services
```dockerfile
# Agent Base Image
FROM node:18-alpine AS base
WORKDIR /app
RUN apk add --no-cache git python3 make g++
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Build Stage
FROM base AS build
COPY . .
RUN npm run build
RUN npm run test:unit

# Production Stage
FROM node:18-alpine AS production
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nexus && \
    adduser -S nexus -u 1001

# Install security updates
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init

# Copy built application
COPY --from=build --chown=nexus:nexus /app/dist ./dist
COPY --from=build --chown=nexus:nexus /app/node_modules ./node_modules
COPY --from=build --chown=nexus:nexus /app/package.json ./

# Set up health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node dist/health-check.js

USER nexus
EXPOSE 8080 9090

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
```

### 2. Specialized Agent Dockerfiles
```dockerfile
# Portfolio Manager Agent
FROM nexus/agent-base:v1.0.0

LABEL maintainer="NEXUS AI Team <team@nexus-ai.com>"
LABEL version="1.0.0"
LABEL description="Portfolio Manager Agent for NEXUS AI DeFi"

# Install specific dependencies
COPY portfolio-manager/package*.json ./
RUN npm ci --only=production

# Copy agent-specific code
COPY portfolio-manager/src ./src
COPY portfolio-manager/config ./config

# Build agent
RUN npm run build

# Set agent-specific environment
ENV AGENT_TYPE=PORTFOLIO_MANAGER
ENV LOG_LEVEL=info
ENV METRICS_PORT=9090

# Health check for portfolio agent
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8080/health/portfolio || exit 1

CMD ["node", "dist/portfolio-manager.js"]
```

## CI/CD Pipeline Configuration

### 1. GitHub Actions Workflow
```yaml
name: NEXUS AI DeFi CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_PREFIX: nexus-ai-defi

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      redis:
        image: redis:7.0.5
        ports:
          - 6379:6379
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linting
      run: npm run lint
    
    - name: Run type checking
      run: npm run type-check
    
    - name: Run unit tests
      run: npm run test:unit
      env:
        REDIS_URL: redis://localhost:6379
        DATABASE_URL: postgresql://postgres:test@localhost:5432/nexus_test
    
    - name: Run integration tests
      run: npm run test:integration
    
    - name: Generate coverage report
      run: npm run test:coverage
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3

  security:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    
    - name: Run security audit
      run: npm audit --audit-level moderate
    
    - name: Run SAST with Semgrep
      uses: returntocorp/semgrep-action@v1
      with:
        config: >-
          p/security-audit
          p/secrets
          p/nodejs
    
    - name: Run dependency vulnerability scan
      uses: actions/dependency-review-action@v3

  build:
    needs: [test, security]
    runs-on: ubuntu-latest
    strategy:
      matrix:
        component:
          - agent-orchestrator
          - portfolio-manager
          - arbitrage-hunter
          - risk-manager
          - execution-engine
          - analytics-core
          - payment-processor
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3
    
    - name: Log in to Container Registry
      uses: docker/login-action@v3
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}
    
    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v5
      with:
        images: ${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}/${{ matrix.component }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=sha
          type=raw,value=latest,enable={{is_default_branch}}
    
    - name: Build and push Docker image
      uses: docker/build-push-action@v5
      with:
        context: .
        file: ./docker/${{ matrix.component }}/Dockerfile
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
        cache-from: type=gha
        cache-to: type=gha,mode=max

  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'
    environment: staging
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-west-2
    
    - name: Deploy to staging
      run: |
        aws eks update-kubeconfig --region us-west-2 --name nexus-staging
        helm upgrade --install nexus-staging ./helm/nexus-ai-defi \
          --namespace staging \
          --set image.tag=${{ github.sha }} \
          --set environment=staging \
          --values ./helm/values-staging.yaml

  deploy-production:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-west-2
    
    - name: Deploy to production (blue-green)
      run: |
        aws eks update-kubeconfig --region us-west-2 --name nexus-production
        
        # Deploy to green environment
        helm upgrade --install nexus-green ./helm/nexus-ai-defi \
          --namespace production-green \
          --set image.tag=${{ github.sha }} \
          --set environment=production \
          --values ./helm/values-production.yaml
        
        # Run smoke tests
        ./scripts/smoke-tests.sh production-green
        
        # Switch traffic to green
        kubectl patch service nexus-load-balancer \
          --type='json' \
          -p='[{"op": "replace", "path": "/spec/selector/version", "value": "green"}]'
        
        # Wait for traffic switch
        sleep 60
        
        # Cleanup blue environment
        helm uninstall nexus-blue --namespace production-blue || true
```

### 2. Helm Chart Configuration
```yaml
# values.yaml
global:
  environment: production
  registry: ghcr.io/nexus-ai-defi
  imageTag: latest
  pullPolicy: IfNotPresent

replicaCount:
  orchestrator: 3
  portfolioManager: 5
  arbitrageHunter: 8
  riskManager: 3
  executionEngine: 10
  analyticsCore: 4
  paymentProcessor: 3

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 50
  targetCPUUtilization: 70
  targetMemoryUtilization: 80

resources:
  orchestrator:
    requests:
      memory: 1Gi
      cpu: 500m
    limits:
      memory: 2Gi
      cpu: 1
  
  agents:
    requests:
      memory: 512Mi
      cpu: 250m
    limits:
      memory: 1Gi
      cpu: 500m

networking:
  loadBalancer:
    enabled: true
    type: ALB
    annotations:
      kubernetes.io/ingress.class: alb
      alb.ingress.kubernetes.io/scheme: internet-facing
      alb.ingress.kubernetes.io/target-type: ip
  
  ingress:
    enabled: true
    className: alb
    hosts:
      - host: api.nexus-ai.com
        paths:
          - path: /
            pathType: Prefix
    tls:
      - secretName: nexus-tls
        hosts:
          - api.nexus-ai.com

persistence:
  redis:
    enabled: true
    size: 100Gi
    storageClass: gp3
  
  postgresql:
    enabled: true
    size: 500Gi
    storageClass: gp3

monitoring:
  prometheus:
    enabled: true
    retention: 30d
    storage: 1Ti
  
  grafana:
    enabled: true
    adminPassword: "secure-password"
  
  alerts:
    enabled: true
    slack:
      webhookUrl: "https://hooks.slack.com/services/..."
    pagerduty:
      routingKey: "your-routing-key"

security:
  networkPolicies:
    enabled: true
  
  podSecurityPolicy:
    enabled: true
  
  rbac:
    enabled: true
  
  secrets:
    database:
      create: true
    redis:
      create: true
    agents:
      create: true

backup:
  enabled: true
  schedule: "0 2 * * *"  # Daily at 2 AM
  retention: 30
  destination: s3://nexus-backups/
```

## Production Operational Procedures

### 1. Deployment Strategies
```typescript
class DeploymentManager {
  async blueGreenDeployment(
    newVersion: string,
    environment: Environment
  ): Promise<DeploymentResult> {
    const stages = [
      'validate-prerequisites',
      'deploy-green-environment',
      'run-smoke-tests',
      'switch-traffic',
      'monitor-health',
      'cleanup-blue-environment'
    ];
    
    for (const stage of stages) {
      await this.executeStage(stage, newVersion, environment);
    }
    
    return {
      success: true,
      version: newVersion,
      deploymentTime: Date.now(),
      rollbackPlan: this.generateRollbackPlan(environment)
    };
  }
  
  async canaryDeployment(
    newVersion: string,
    trafficPercentage: number = 5
  ): Promise<DeploymentResult> {
    // Deploy canary version
    await this.deployCanaryVersion(newVersion);
    
    // Gradually increase traffic
    const stages = [5, 10, 25, 50, 100];
    
    for (const percentage of stages) {
      await this.adjustTrafficSplit(percentage, newVersion);
      await this.monitorMetrics(300); // 5 minutes
      
      if (await this.detectIssues()) {
        await this.rollback();
        throw new Error('Canary deployment failed');
      }
    }
    
    return { success: true, version: newVersion };
  }
}
```

### 2. Monitoring and Alerting Configuration
```yaml
# Prometheus Rules
groups:
- name: nexus-agents
  rules:
  - alert: AgentHighErrorRate
    expr: rate(agent_errors_total[5m]) > 0.1
    for: 2m
    labels:
      severity: warning
    annotations:
      summary: "High error rate detected for agent {{ $labels.agent_id }}"
      
  - alert: AgentDown
    expr: up{job="nexus-agents"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Agent {{ $labels.instance }} is down"

- name: nexus-financial
  rules:
  - alert: LargePortfolioLoss
    expr: portfolio_pnl_daily < -10000
    for: 0m
    labels:
      severity: critical
    annotations:
      summary: "Large portfolio loss detected: ${{ $value }}"
      
  - alert: HighRiskScore
    expr: portfolio_risk_score > 80
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High risk score for portfolio {{ $labels.portfolio_id }}"

- name: nexus-system
  rules:
  - alert: HighCPUUsage
    expr: (100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[2m])) * 100)) > 80
    for: 2m
    labels:
      severity: warning
    annotations:
      summary: "High CPU usage on {{ $labels.instance }}"
```

### 3. Disaster Recovery Procedures
```bash
#!/bin/bash
# Disaster Recovery Script

set -e

BACKUP_LOCATION="s3://nexus-dr-backups"
PRIMARY_REGION="us-west-2"
DR_REGION="us-east-1"

disaster_recovery() {
    echo "Starting disaster recovery procedure..."
    
    # 1. Assess primary region status
    if ! check_primary_region_health; then
        echo "Primary region unhealthy, initiating failover"
        
        # 2. Restore data in DR region
        restore_database_from_backup "$BACKUP_LOCATION" "$DR_REGION"
        restore_redis_from_backup "$BACKUP_LOCATION" "$DR_REGION"
        
        # 3. Deploy services in DR region
        deploy_to_region "$DR_REGION"
        
        # 4. Update DNS to point to DR region
        update_dns_records "$DR_REGION"
        
        # 5. Verify system health
        verify_system_health "$DR_REGION"
        
        # 6. Notify stakeholders
        send_notification "Disaster recovery completed. System running in DR region."
    fi
}

check_primary_region_health() {
    kubectl --context="$PRIMARY_REGION" get nodes >/dev/null 2>&1
}

restore_database_from_backup() {
    local backup_location=$1
    local region=$2
    
    echo "Restoring database from backup..."
    aws s3 cp "$backup_location/latest/postgresql.sql.gz" - | \
        gunzip | \
        kubectl --context="$region" exec -i postgresql-0 -- psql -U nexus_user nexus
}

# Execute disaster recovery if called directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    disaster_recovery "$@"
fi
```

This comprehensive deployment architecture ensures robust, scalable, and maintainable operations for the NEXUS AI DeFi platform in production environments.