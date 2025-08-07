/**
 * Health Check Routes
 * 
 * 모든 마이크로서비스의 상태를 통합하여 제공하는 엔드포인트
 * Frontend Dashboard에서 사용
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import { createLogger } from '../utils/logger.util';
import * as winston from 'winston';

interface ServiceHealth {
  name: string;
  key: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  responseTime: number;
  details?: any;
  error?: string;
}

interface HealthCheckConfig {
  name: string;
  key: string;
  url: string;
}

export class HealthRoutes {
  private router: Router;
  private logger: winston.Logger;
  
  // 서비스 Health 엔드포인트 설정
  private readonly services: HealthCheckConfig[] = [
    { 
      name: 'Storage Service', 
      key: 'storage',
      url: 'http://storage:8001/health' 
    },
    { 
      name: 'Device Service', 
      key: 'device',
      url: 'http://device-service:8101/health' 
    },
    { 
      name: 'MCP Service', 
      key: 'mcp',
      url: 'http://mcp-service:8201/api/v1/health' 
    },
    { 
      name: 'LLM Service', 
      key: 'llm',
      url: 'http://llm-service:8301/health' 
    },
    { 
      name: 'Workflow Engine', 
      key: 'workflow',
      url: 'http://workflow-engine:8401/health' 
    },
    { 
      name: 'n8n Workflow Engine', 
      key: 'n8n',
      url: 'http://automation-n8n:5678/healthz' 
    }
  ];
  
  constructor() {
    this.router = Router();
    this.logger = createLogger();
    this.setupRoutes();
  }
  
  private setupRoutes(): void {
    /**
     * GET /health (마운트: /api/v1/system/health)
     * 모든 서비스의 상태를 통합하여 반환
     */
    this.router.get('/health', async (req: Request, res: Response) => {
      try {
        this.logger.info('[Health] 시스템 헬스체크 시작');
        
        // 병렬로 모든 서비스 상태 확인
        const healthChecks = await Promise.allSettled(
          this.services.map(async (service) => {
            const start = Date.now();
            try {
              const response = await axios.get(service.url, { 
                timeout: 5000,
                validateStatus: (status) => status < 500 // 4xx는 성공으로 처리
              });
              
              return {
                name: service.name,
                key: service.key,
                status: 'healthy' as const,
                responseTime: Date.now() - start,
                details: response.data
              };
            } catch (error: any) {
              this.logger.warn(`[Health] ${service.name} 헬스체크 실패:`, {
                service: service.key,
                error: error.message
              });
              
              return {
                name: service.name,
                key: service.key,
                status: 'unhealthy' as const,
                responseTime: Date.now() - start,
                error: error.message
              };
            }
          })
        );
        
        // 결과 정리
        const results: ServiceHealth[] = healthChecks.map((result, index) => {
          if (result.status === 'fulfilled') {
            return result.value;
          } else {
            // Promise 자체가 실패한 경우
            return {
              name: this.services[index].name,
              key: this.services[index].key,
              status: 'unknown' as const,
              responseTime: 0,
              error: result.reason?.message || 'Unknown error'
            };
          }
        });
        
        // 전체 시스템 상태 계산
        const healthyCount = results.filter(s => s.status === 'healthy').length;
        const totalCount = results.length;
        const overallStatus = healthyCount === totalCount ? 'healthy' : 
                            healthyCount > 0 ? 'degraded' : 'unhealthy';
        
        this.logger.info('[Health] 시스템 헬스체크 완료', {
          overallStatus,
          healthyCount,
          totalCount
        });
        
        res.json({
          timestamp: new Date().toISOString(),
          status: overallStatus,
          healthy: healthyCount,
          total: totalCount,
          services: results
        });
        
      } catch (error: any) {
        this.logger.error('[Health] 시스템 헬스체크 오류:', error);
        
        res.status(500).json({
          error: 'HEALTH_CHECK_ERROR',
          message: '시스템 헬스체크 중 오류가 발생했습니다.',
          timestamp: new Date().toISOString()
        });
      }
    });
    
    /**
     * GET /gateway (마운트: /api/v1/system/gateway)
     * Gateway 자체의 상태 확인
     */
    this.router.get('/gateway', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        service: 'api-gateway',
        version: '3.1.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });
  }
  
  getRouter(): Router {
    return this.router;
  }
}
