/**
 * Health Check Controller
 * 시스템 상태 확인 엔드포인트
 */

import { Request, Response, Router } from 'express';
import { CacheService, MetricsService, EventBusService } from '../services';
import { createLogger } from '../utils/logger';

export class HealthController {
  private router = Router();
  private cacheService: CacheService;
  private metricsService: MetricsService;
  private eventBusService: EventBusService;
  private logger = createLogger();

  constructor(
    cacheService: CacheService,
    metricsService: MetricsService,
    eventBusService: EventBusService
  ) {
    this.cacheService = cacheService;
    this.metricsService = metricsService;
    this.eventBusService = eventBusService;
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.router.get('/', this.getHealth.bind(this));
    this.router.get('/ready', this.getReadiness.bind(this));
    this.router.get('/live', this.getLiveness.bind(this));
  }

  getRouter(): Router {
    return this.router;
  }

  // GET /health
  async getHealth(req: Request, res: Response): Promise<void> {
    try {
      const health = {
        service: 'device-management-service',
        version: process.env.SERVICE_VERSION || '1.0.0',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        dependencies: {
          redis: await this.checkRedis(),
          influxdb: await this.checkInfluxDB(),
          kafka: await this.checkKafka()
        }
      };

      // 전체 상태 결정
      const allHealthy = Object.values(health.dependencies).every(dep => dep.status === 'healthy');
      health.status = allHealthy ? 'healthy' : 'unhealthy';

      const statusCode = allHealthy ? 200 : 503;
      res.status(statusCode).json(health);
    } catch (error) {
      this.logger.error('Health check failed', error);
      res.status(503).json({
        service: 'device-management-service',
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      });
    }
  }

  // GET /health/ready
  async getReadiness(req: Request, res: Response): Promise<void> {
    try {
      // 서비스 준비 상태 확인
      const ready = {
        service: 'device-management-service',
        ready: true,
        timestamp: new Date().toISOString(),
        checks: {
          redis: await this.checkServiceHealth(this.cacheService),
          influxdb: await this.checkServiceHealth(this.metricsService),
          kafka: await this.checkServiceHealth(this.eventBusService)
        }
      };

      ready.ready = Object.values(ready.checks).every(check => check === true);

      const statusCode = ready.ready ? 200 : 503;
      res.status(statusCode).json(ready);
    } catch (error) {
      this.logger.error('Readiness check failed', error);
      res.status(503).json({
        service: 'device-management-service',
        ready: false,
        timestamp: new Date().toISOString(),
        error: 'Readiness check failed'
      });
    }
  }

  // GET /health/live
  async getLiveness(req: Request, res: Response): Promise<void> {
    // 간단한 liveness 체크 (프로세스가 살아있는지만 확인)
    res.json({
      service: 'device-management-service',
      alive: true,
      timestamp: new Date().toISOString(),
      pid: process.pid,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    });
  }

  private async checkServiceHealth(service: any): Promise<boolean> {
    try {
      if (typeof service.ping === 'function') {
        return await service.ping();
      }
      return true; // ping 메서드가 없으면 일단 healthy로 간주
    } catch (error) {
      this.logger.warn('Service health check failed:', error);
      return false;
    }
  }

  private async checkRedis(): Promise<{ status: string; responseTime?: number; error?: string }> {
    try {
      const start = Date.now();
      const result = await this.checkServiceHealth(this.cacheService);
      const responseTime = Date.now() - start;
      
      return {
        status: result ? 'healthy' : 'unhealthy',
        responseTime: result ? responseTime : undefined
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: (error as Error).message
      };
    }
  }

  private async checkInfluxDB(): Promise<{ status: string; responseTime?: number; error?: string }> {
    try {
      const start = Date.now();
      const result = await this.checkServiceHealth(this.metricsService);
      const responseTime = Date.now() - start;
      
      return {
        status: result ? 'healthy' : 'unhealthy',
        responseTime: result ? responseTime : undefined
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: (error as Error).message
      };
    }
  }

  private async checkKafka(): Promise<{ status: string; responseTime?: number; error?: string }> {
    try {
      const start = Date.now();
      const result = await this.checkServiceHealth(this.eventBusService);
      const responseTime = Date.now() - start;
      
      return {
        status: result ? 'healthy' : 'unhealthy',
        responseTime: result ? responseTime : undefined
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: (error as Error).message
      };
    }
  }
}
