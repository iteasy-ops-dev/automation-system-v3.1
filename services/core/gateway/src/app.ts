import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import * as winston from 'winston';
import { Server as HttpServer } from 'http';
import { config, validateConfig } from './config/gateway.config';
import { createLogger } from './utils/logger.util';
import { RedisManager } from './utils/redis.util';
import { JWTAuthService } from './services/jwt-auth.service';
import { AuthController } from './controllers/auth.controller';
import { AuthMiddleware } from './middleware/auth.middleware';
import { RateLimitMiddleware } from './middleware/rate-limit.middleware';
import { AuthRoutes } from './routes/auth.routes';
import { ProxyRoutes } from './routes/proxy.routes';
import { HealthRoutes } from './routes/health.routes';
import { WebSocketHandler, websocketService } from './websocket';
import { KafkaManager } from './services/kafka-manager';
import { ErrorResponse } from './types/gateway.types';

/**
 * Express 애플리케이션 클래스
 * Gateway Service 메인 애플리케이션
 */
export class GatewayApp {
  private app: Application;
  private logger: winston.Logger;
  private server?: any; // HTTP server instance
  private jwtAuthService!: JWTAuthService;
  private authController!: AuthController;
  private authMiddleware!: AuthMiddleware;
  private rateLimitMiddleware!: RateLimitMiddleware;
  private webSocketHandler?: WebSocketHandler;
  private kafkaManager!: KafkaManager;

  constructor() {
    this.app = express();
    this.logger = createLogger();
    
    // 설정 검증
    try {
      validateConfig();
      this.logger.info('설정 검증 완료', { 
        port: config.server.port,
        redisHost: config.redis.host,
        storageServiceUrl: config.storage.serviceUrl
      });
    } catch (error) {
      this.logger.error('설정 검증 실패', { error });
      process.exit(1);
    }
  }

  /**
   * 애플리케이션 초기화
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Gateway 서비스 초기화 시작...');

      // Redis 연결 설정
      RedisManager.setLogger(this.logger);
      const redis = await RedisManager.getConnection();

      // 서비스 인스턴스 생성
      this.jwtAuthService = new JWTAuthService(redis, this.logger);
      this.authController = new AuthController(this.jwtAuthService, this.logger);
      this.authMiddleware = new AuthMiddleware(this.jwtAuthService, this.logger);
      this.rateLimitMiddleware = new RateLimitMiddleware(redis, this.logger);
      
      // WebSocket Handler는 서버 시작 시 초기화됨
      
      // Kafka Manager 초기화 (옵션)
      try {
        this.kafkaManager = new KafkaManager(this.logger);
        this.logger.info('Kafka Manager 연결 완료');
      } catch (error) {
        this.logger.warn('Kafka Manager 초기화 실패', { error });
      }

      // Express 미들웨어 설정
      this.setupMiddleware();
      
      // 라우터 설정
      this.setupRoutes();
      
      // 에러 핸들러 설정
      this.setupErrorHandlers();

      this.logger.info('Gateway 서비스 초기화 완료');
    } catch (error) {
      this.logger.error('Gateway 서비스 초기화 실패', { error });
      throw error;
    }
  }

  /**
   * Express 미들웨어 설정
   */
  private setupMiddleware(): void {
    // 보안 헤더 설정
    this.app.use(helmet({
      contentSecurityPolicy: false, // API 서버이므로 CSP 비활성화
      crossOriginEmbedderPolicy: false
    }));

    // CORS 설정
    this.app.use(cors({
      origin: config.server.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }));

    // 압축
    this.app.use(compression());

    // 🔧 핵심 수정: 조건부 body parser
    // 프록시 라우트가 아닌 경우에만 body parser 적용
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      // /api/v1/auth 라우트에만 body parser 적용
      if (req.path.startsWith('/api/v1/auth') || req.path === '/health') {
        express.json({ limit: '10mb' })(req, res, () => {
          express.urlencoded({ extended: true, limit: '10mb' })(req, res, next);
        });
      } else {
        // 프록시 라우트는 body parser 건너뛰기
        next();
      }
    });

    // 프록시 신뢰 설정
    if (config.server.trustProxy) {
      this.app.set('trust proxy', true);
    }

    // 요청 로깅
    this.app.use(morgan('combined', {
      stream: {
        write: (message) => this.logger.info(message.trim())
      }
    }));

    this.logger.info('Express 미들웨어 설정 완료 - 프록시 최적화');
  }

  /**
   * 라우터 설정
   */
  private setupRoutes(): void {
    // 헬스체크 엔드포인트
    this.app.get('/health', (req: Request, res: Response) => {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '3.1.0',
        service: 'api-gateway'
      });
    });

    // 시스템 헬스체크 - HealthRoutes 클래스 사용
    const healthRoutes = new HealthRoutes();
    this.app.use('/api/v1/system', healthRoutes.getRouter());

    // API 버전별 라우팅
    const authRoutes = new AuthRoutes(
      this.authController,
      this.authMiddleware,
      this.rateLimitMiddleware,
      this.logger
    );

    // 디버깅: 모든 요청 로깅
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      this.logger.info(`[Gateway] Incoming request:`, {
        method: req.method,
        url: req.url,
        originalUrl: req.originalUrl,
        headers: req.headers,
        body: req.body
      });
      next();
    });

    // 인증 라우트 (인증 불필요)
    this.app.use('/api/v1/auth', authRoutes.getRouter());

    // 프록시 라우트 설정
    const proxyRoutes = new ProxyRoutes();
    
    // 프록시 라우트에 인증 미들웨어 적용
    // 중요: 프록시 라우트는 404 핸들러보다 먼저 등록되어야 함
    this.app.use('/api/v1', 
      this.authMiddleware.authenticate(),
      (req: Request, res: Response, next: NextFunction) => {
        this.logger.debug(`[Gateway] After auth, before proxy:`, {
          method: req.method,
          originalUrl: req.originalUrl,
          baseUrl: req.baseUrl,
          path: req.path,
          url: req.url,
          user: (req as any).user?.username
        });
        next();
      },
      proxyRoutes.getRouter()
    );

    // 라우트 로깅
    this.logger.info('라우터 설정 완료', {
      routes: [
        'GET /health',
        'POST /api/v1/auth/login',
        'POST /api/v1/auth/refresh', 
        'POST /api/v1/auth/logout',
        'GET /api/v1/auth/verify',
        // 프록시 라우트
        'PROXY /api/v1/storage/*',
        'PROXY /api/v1/devices/*',
        'PROXY /api/v1/mcp/*',
        'PROXY /api/v1/llm/*',
        'PROXY /api/v1/workflows/*',
        // WebSocket
        'WS /ws'
      ]
    });

    // 404 핸들러 - 모든 라우트 설정 후 마지막에 등록
    this.app.use('*', (req: Request, res: Response) => {
      const errorResponse: ErrorResponse = {
        error: 'NOT_FOUND',
        message: `경로를 찾을 수 없습니다: ${req.method} ${req.originalUrl}`,
        timestamp: new Date().toISOString()
      };
      
      this.logger.debug(`[Gateway] 404 Not Found:`, {
        method: req.method,
        originalUrl: req.originalUrl,
        headers: req.headers
      });
      
      res.status(404).json(errorResponse);
    });
  }

  /**
   * 에러 핸들러 설정
   */
  private setupErrorHandlers(): void {
    // 전역 에러 핸들러
    this.app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
      this.logger.error('처리되지 않은 에러', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        ip: req.ip
      });

      const errorResponse: ErrorResponse = {
        error: 'INTERNAL_SERVER_ERROR',
        message: '서버 내부 오류가 발생했습니다.',
        timestamp: new Date().toISOString()
      };

      res.status(500).json(errorResponse);
    });

    this.logger.info('에러 핸들러 설정 완료');
  }

  /**
   * 서버 시작
   */
  async start(): Promise<void> {
    const port = config.server.port;
    const host = config.server.host;

    return new Promise((resolve, reject) => {
      const server = this.app.listen(port, host, () => {
        this.logger.info('Gateway 서버가 시작되었습니다.', {
          port,
          host,
          env: process.env.NODE_ENV || 'development',
          websocket: 'enabled'
        });
        
        // WebSocket Handler 초기화
        this.webSocketHandler = new WebSocketHandler(server, {
          host: config.redis.host,
          port: config.redis.port,
          password: config.redis.password
        }, this.jwtAuthService);
        
        // WebSocket Service에 핸들러 설정
        websocketService.setHandler(this.webSocketHandler);
        
        this.logger.info('WebSocket 서버가 활성화되었습니다.', {
          path: '/ws',
          transport: 'Socket.IO'
        });
        
        resolve();
      });

      server.on('error', (error) => {
        this.logger.error('서버 시작 실패', { error });
        reject(error);
      });

      // 서버 인스턴스 저장 (graceful shutdown용)
      this.server = server;

      // Graceful shutdown 처리
      process.on('SIGTERM', () => this.gracefulShutdown());
      process.on('SIGINT', () => this.gracefulShutdown());
    });
  }

  /**
   * Express Application 인스턴스 반환
   */
  getApp(): Application {
    return this.app;
  }

  /**
   * Graceful shutdown 처리
   */
  private async gracefulShutdown(): Promise<void> {
    this.logger.info('서버 종료 신호를 받았습니다. Graceful shutdown을 시작합니다...');
    
    try {
      // 새로운 연결 받기 중단
      if (this.server) {
        this.server.close(async () => {
          this.logger.info('HTTP 서버가 종료되었습니다.');
          
          try {
            // WebSocket 정리
            if (this.webSocketHandler) {
              await this.webSocketHandler.shutdown();
              this.logger.info('WebSocket 서버가 종료되었습니다.');
            }
            
            // Redis 연결 종료
            await RedisManager.closeConnection();
            
            this.logger.info('모든 연결이 안전하게 종료되었습니다.');
            process.exit(0);
          } catch (error) {
            this.logger.error('Graceful shutdown 중 오류 발생', { error });
            process.exit(1);
          }
        });
      } else {
        process.exit(0);
      }

      // 타임아웃 설정 (30초)
      setTimeout(() => {
        this.logger.error('Graceful shutdown 타임아웃. 강제 종료합니다.');
        process.exit(1);
      }, 30000);
      
    } catch (error) {
      this.logger.error('Graceful shutdown 실패', { error });
      process.exit(1);
    }
  }
}