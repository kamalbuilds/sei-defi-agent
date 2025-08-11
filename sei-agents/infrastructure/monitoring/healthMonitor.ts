// Health Monitoring System
import { logger } from '../../utils/logger';

interface HealthStatus {
  healthy: boolean;
  lastCheck: Date;
  errors: string[];
  uptime: number;
}

export class HealthMonitor {
  private status: Map<string, HealthStatus> = new Map();
  private startTime: Date = new Date();
  
  // Register a component for health monitoring
  register(componentId: string): void {
    this.status.set(componentId, {
      healthy: true,
      lastCheck: new Date(),
      errors: [],
      uptime: 0
    });
    logger.debug(`Health monitor registered: ${componentId}`);
  }
  
  // Update health status
  updateHealth(componentId: string, healthy: boolean, error?: string): void {
    const current = this.status.get(componentId);
    if (current) {
      current.healthy = healthy;
      current.lastCheck = new Date();
      current.uptime = Date.now() - this.startTime.getTime();
      
      if (error) {
        current.errors.push(error);
        // Keep only last 10 errors
        if (current.errors.length > 10) {
          current.errors.shift();
        }
      }
      
      if (!healthy) {
        logger.warn(`Component ${componentId} unhealthy: ${error}`);
      }
    }
  }
  
  // Check if component is healthy
  isHealthy(componentId: string): boolean {
    const status = this.status.get(componentId);
    return status ? status.healthy : false;
  }
  
  // Get overall system health
  getSystemHealth(): { healthy: boolean; components: number; unhealthy: string[] } {
    const unhealthy: string[] = [];
    
    this.status.forEach((status, id) => {
      if (!status.healthy) {
        unhealthy.push(id);
      }
    });
    
    return {
      healthy: unhealthy.length === 0,
      components: this.status.size,
      unhealthy
    };
  }
  
  // Get detailed health report
  getHealthReport(): any {
    const report: any = {
      system: this.getSystemHealth(),
      uptime: Date.now() - this.startTime.getTime(),
      timestamp: new Date().toISOString(),
      components: {}
    };
    
    this.status.forEach((status, id) => {
      report.components[id] = {
        ...status,
        lastCheck: status.lastCheck.toISOString()
      };
    });
    
    return report;
  }
  
  // Start periodic health checks
  startHealthChecks(interval: number = 60000): void {
    setInterval(() => {
      const health = this.getSystemHealth();
      if (!health.healthy) {
        logger.warn(`System unhealthy - ${health.unhealthy.length} components failing`);
      }
    }, interval);
  }
}

// Export singleton instance
export const healthMonitor = new HealthMonitor();

export default healthMonitor;