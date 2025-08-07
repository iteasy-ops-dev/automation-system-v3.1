/**
 * Health Controller - 헬스체크 및 시스템 상태
 */

import { Request, Response } from 'express';
import { ServiceManager } from '../services';
import logger from '../utils/logger';

export class HealthController {
  constructor(private serviceManager: ServiceManager) {}

  /**
   * 기본 헬스체크
   */
  async health(req: Request, res: Response): Promise<void> {
    try {
      const llmService = this.serviceManager.getLLMService();
      const healthStatus = await llmService.healthCheck();
      
      res.status(healthStatus.status === 'healthy' ? 200 : 503).json(healthStatus);
    } catch (error) {
      logger.error('Health check failed:', error);
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
      });
    }
  }

  /**
   * 준비 상태 확인 (Kubernetes readiness probe)
   */
  async ready(req: Request, res: Response): Promise<void> {
    try {
      const cacheService = this.serviceManager.getCacheService();
      const mongoService = this.serviceManager.getMongoService();
      const postgresService = this.serviceManager.getPostgresService();

      const checks = await Promise.all([
        cacheService.healthCheck(),
        mongoService.healthCheck(),
        postgresService.healthCheck(),
      ]);

      const isReady = checks.every(check => check);

      res.status(isReady ? 200 : 503).json({
        ready: isReady,
        services: {
          cache: checks[0],
          mongo: checks[1],
          postgres: checks[2],
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Readiness check failed:', error);
      res.status(503).json({
        ready: false,
        error: 'Readiness check failed',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * 활성 상태 확인 (Kubernetes liveness probe)
   */
  async live(req: Request, res: Response): Promise<void> {
    try {
      // 간단한 활성 상태 확인
      res.status(200).json({
        alive: true,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Liveness check failed:', error);
      res.status(503).json({
        alive: false,
        error: 'Liveness check failed',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * 시스템 통계
   */
  async stats(req: Request, res: Response): Promise<void> {
    try {
      const memUsage = process.memoryUsage();

      res.status(200).json({
        uptime: process.uptime(),
        memory: {
          rss: Math.round(memUsage.rss / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          external: Math.round(memUsage.external / 1024 / 1024),
        },
        cpu: process.cpuUsage(),
        pid: process.pid,
        version: process.version,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Stats check failed:', error);
      res.status(500).json({
        error: 'Stats collection failed',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
