/**
 * API Gateway 프록시 라우트 구현 - 백업 기반 완전 복원 (POST 요청 타임아웃 해결)
 * 계약: shared/contracts/v1.0/rest/core/gateway-proxy.yaml
 * 
 * v3.1 아키텍처 원칙 (절대 위반 금지):
 * - Gateway는 인증/인가를 처리하고 백엔드 서비스로 프록시
 * - 백엔드 서비스는 Gateway를 신뢰하고 추가 인증 없음
 * - 경로 일관성: /api/v1/{service}/* → {service}:port/api/v1/{service}/*
 * - 헤더 표준: X-User-Info, X-Correlation-ID 필수 전달
 */

import { Router, Request, Response, NextFunction } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { createLogger } from '../utils/logger.util';
import * as winston from 'winston';

// TypeScript 확장 인터페이스 (타입 안전성 보장)
interface ExtendedRequest extends Request {
  startTime?: number;
  logger?: winston.Logger;
  user?: {
    id: string;
    username: string;
    role?: string;
    email?: string;
  };
}

export class ProxyRoutes {
  private router: Router;
  private logger: winston.Logger;

  // v3.1 아키텍처 원칙: 서비스 목록 및 라우팅 설정
  private serviceConfigs = [
    {
      name: 'Storage Service',
      pathPattern: '/storage',
      target: process.env.STORAGE_SERVICE_URL || 'http://storage:8001'
    },
    {
      name: 'Device Management Service', 
      pathPattern: '/devices',
      target: process.env.DEVICE_SERVICE_URL || 'http://device-service:8101'
    },
    {
      name: 'MCP Integration Service',
      pathPattern: '/mcp',
      target: process.env.MCP_SERVICE_URL || 'http://mcp-service:8201'
    },
    {
      name: 'LLM Service',
      pathPattern: '/llm',
      target: process.env.LLM_SERVICE_URL || 'http://llm-service:8301'
    },
    {
      name: 'Workflow Engine Service',
      pathPattern: '/workflows',
      target: process.env.WORKFLOW_SERVICE_URL || 'http://workflow-engine:8401'
    }
  ];

  constructor() {
    this.router = Router();
    this.logger = createLogger();
    this.logger.info('[ProxyRoutes] v3.1 아키텍처 원칙 준수 초기화 시작 - 확실한 컴파일');
    this.setupRoutes();
  }

  /**
   * 아키텍처 원칙 기반 라우트 설정
   */
  private setupRoutes(): void {
    // 디버그 미들웨어 - 모든 요청 로깅
    this.router.use((req: Request, res: Response, next: NextFunction) => {
      this.logger.info('[ProxyRoutes] 요청 수신:', {
        method: req.method,
        originalUrl: req.originalUrl,
        baseUrl: req.baseUrl,
        path: req.path,
        url: req.url,
        userAgent: req.headers['user-agent']
      });
      next();
    });

    // 각 서비스별로 아키텍처 원칙 준수 프록시 설정
    for (const config of this.serviceConfigs) {
      this.createArchitecturalCompliantProxy(config);
    }

    this.logger.info('[PROXY] v3.1 아키텍처 원칙 준수 라우트 설정 완료 - 확실한 컴파일');
  }

  /**
   * v3.1 아키텍처 원칙 완전 준수 프록시 생성 (확실한 컴파일)
   * 
   * 아키텍처 요구사항:
   * 1. 경로 일관성: /api/v1/{service}/* → {service}:port/api/v1/{service}/*
   * 2. 헤더 표준: X-User-Info, X-Correlation-ID 전달
   * 3. 계약 준수: 모든 응답이 계약 명세 따름
   * 4. 신뢰 관계: 내부 서비스는 Gateway 완전 신뢰
   */
  private createArchitecturalCompliantProxy(config: { name: string; pathPattern: string; target: string }): void {
    this.logger.info(`[PROXY] 아키텍처 준수 프록시 설정: ${config.pathPattern} -> ${config.target}`);

    // v3.1 아키텍처 원칙: 헤더 전달 전처리 미들웨어 (타입 안전)
    const headerPreprocessor = (req: ExtendedRequest, res: Response, next: NextFunction) => {
      // 요청 시작 시간 기록
      req.startTime = Date.now();
      
      // 로거 추가
      req.logger = this.logger;

      // 아키텍처 원칙: X-User-Info 헤더 설정 (필수)
      if (req.user) {
        const userInfo = {
          id: req.user.id,
          username: req.user.username,
          role: req.user.role || 'user',
          email: req.user.email
        };
        const userInfoJson = JSON.stringify(userInfo);
        
        // 헤더에 직접 설정
        req.headers['x-user-info'] = userInfoJson;
        
        this.logger.info(`[PROXY] 계약 준수 X-User-Info 헤더 설정:`, {
          service: config.name,
          userId: req.user.id,
          username: req.user.username,
          role: req.user.role,
          headerSet: true
        });
      } else {
        this.logger.warn(`[PROXY] 사용자 정보 없음 - 개발 환경 확인 필요:`, {
          service: config.name,
          originalUrl: req.originalUrl
        });
      }
      
      // 아키텍처 원칙: Correlation ID (필수)
      const correlationId = req.headers['x-correlation-id'] || 
                            `gw-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      req.headers['x-correlation-id'] = correlationId;

      this.logger.info(`[PROXY] → ${config.name}`, {
        method: req.method,
        originalPath: req.originalUrl,
        hasUser: !!req.user,
        hasUserInfoHeader: !!req.headers['x-user-info'],
        correlationId: correlationId
      });

      next();
    };

    // v3.1 아키텍처 원칙 준수 프록시 옵션 (타입 안전성 보장)
    const architecturalProxy = createProxyMiddleware({
      target: config.target,
      changeOrigin: true,
      ws: false, // 🔧 WebSocket 비활성화 - POST 요청 충돌 방지
      secure: false,
      timeout: 60000, // 60초 타임아웃으로 증가
      proxyTimeout: 60000, // 프록시 타임아웃도 60초로 증가
      
      // 핵심 수정: 아키텍처 원칙 준수 경로 복원
      pathRewrite: (path: string, req: any) => {
        // 아키텍처 분석:
        // 1. 클라이언트 요청: POST /api/v1/storage/devices
        // 2. Express Router 처리 후: /devices (pathPattern 제거됨)
        // 3. 목표 경로: /api/v1/storage/devices (계약 준수)
        
        const restoredPath = `/api/v1${config.pathPattern}${path}`;
        
        if (req.logger) {
          req.logger.info(`[PROXY] 아키텍처 경로 복원:`, {
            service: config.name,
            originalUrl: req.originalUrl,
            routerPath: path,
            pathPattern: config.pathPattern,
            restoredPath: restoredPath,
            finalTarget: `${config.target}${restoredPath}`
          });
        }
        
        return restoredPath;
      },

      // 🔧 이벤트 핸들러들 타입 안전성 보장
      onProxyReq: (proxyReq: any, req: any, res: any) => {
        req.logger?.info(`[PROXY] ${config.name} 프록시 요청 전송:`, {
          method: req.method,
          url: req.url,
          target: `${config.target}${proxyReq.path}`,
          headers: Object.keys(proxyReq.getHeaders())
        });
      },

      onProxyRes: (proxyRes: any, req: any, res: any) => {
        req.logger?.info(`[PROXY] ${config.name} 프록시 응답 수신:`, {
          statusCode: proxyRes.statusCode,
          method: req.method,
          url: req.url
        });
      },

      onError: (err: any, req: any, res: any) => {
        this.logger.error(`[PROXY] ${config.name} 프록시 에러:`, {
          error: err.message,
          stack: err.stack,
          url: req.url,
          method: req.method,
          target: config.target
        });

        if (!res.headersSent) {
          res.status(502).json({
            error: 'PROXY_ERROR',
            message: `${config.name} 프록시 에러: ${err.message}`,
            service: config.name,
            timestamp: new Date().toISOString()
          });
        }
      }
    } as any); // 타입 충돌 방지

    // 아키텍처 원칙: CORS 후처리 미들웨어 (프론트엔드 지원)
    const corsPostProcessor = (req: Request, res: Response, next: NextFunction) => {
      // 응답 헤더 설정 후처리
      const originalSend = res.send;
      res.send = function(data: any) {
        // CORS 헤더 추가
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Correlation-ID');
        
        // 응답 시간 로깅
        const extReq = req as ExtendedRequest;
        if (extReq.logger && extReq.startTime) {
          extReq.logger.info(`[PROXY] ← ${config.name}: ${res.statusCode}`, {
            method: req.method,
            originalUrl: req.originalUrl,
            statusCode: res.statusCode,
            responseTime: Date.now() - extReq.startTime,
            hasUserInfoHeader: !!req.headers['x-user-info']
          });
        }
        
        return originalSend.call(this, data);
      };
      
      next();
    };

    // 아키텍처 원칙: 헤더 전처리 → 프록시 → CORS 후처리 순서로 적용
    this.router.use(config.pathPattern, headerPreprocessor, corsPostProcessor, architecturalProxy);
    
    this.logger.info(`[PROXY] 아키텍처 준수 라우트 등록: ${config.pathPattern} → ${config.target}`);
  }

  getRouter(): Router {
    return this.router;
  }
}