/**
 * API Gateway 메인 애플리케이션
 * 통합 자동화 시스템 v3.1 - Gateway Service
 * 
 * 주요 기능:
 * - JWT 기반 인증/인가
 * - Rate Limiting
 * - API 라우팅 및 프록시
 * - WebSocket 지원
 * - 헬스체크
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import Redis from 'ioredis';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

import { gatewayConfig } from './config/gateway.config';
import { JWTAuthService } from './services/jwt-auth.service';
import { AuthController } from './controllers/auth.controller';
import { AuthMiddleware } from './middleware/auth.middleware';
import { RateLimitMiddleware } from './middleware/rate-limit.middleware';
import { AuthRoutes } from './routes/auth.routes';

export class GatewayApp {
  private app: Application;
  private redis: Redis;
  private logger: winston.Logger;
  
  // Services
  private jwtAuthService: JWTAuthService;
  
  // Controllers
  private authController: AuthController;
  
  // Middleware
  private authMiddleware: AuthMiddleware;
  private rateLimitMiddleware: RateLimitMiddleware;
  
  // Routes
  private authRoutes: AuthRoutes;

  constructor() {
    this.app = express();
    this.setupLogger();
    this.setupRedis();
    this.initializeServices();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * 로거 설정
   */
  private setupLogger(): void {
    this.logger = winston.createLogger({
      level: gatewayConfig.logging.level,
      format: gatewayConfig.logging.format === 'json' 
        ? winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json()
          )
        : winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.simple()
          ),
      transports: [
        new winston.transports.Console(),
        ...(gatewayConfig.logging.file 
          ? [new winston.transports.File({ filename: gatewayConfig.logging.file })]
          : []
        )
      ]
    });

    this.logger.info('Logger initialized', {
      level: gatewayConfig.logging.level,
      format: gatewayConfig.logging.format
    });
  }
  /**
   * Redis 연결 설정
   */
  private setupRedis(): void {
    this.redis = new Redis({
      host: gatewayConfig.redis.host,
      port: gatewayConfig.redis.port,
      password: gatewayConfig.redis.password,
      db: gatewayConfig.redis.database,
      keyPrefix: gatewayConfig.redis.keyPrefix,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    this.redis.on('connect', () => {
      this.logger.info('Redis connected', {
        host: gatewayConfig.redis.host,
        port: gatewayConfig.redis.port,
        database: gatewayConfig.redis.database
      });
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis connection error', {
        error: error.message,
        stack: error.stack
      });
    });
  }

  /**
   * 서비스 초기화
   */
  private initializeServices(): void {
    // JWT 인증 서비스
    this.jwtAuthService = new JWTAuthService(this.redis, this.logger);
    
    // 컨트롤러
    this.authController = new AuthController(this.jwtAuthService, this.logger);
    
    // 미들웨어
    this.authMiddleware = new AuthMiddleware(this.jwtAuthService, this.logger);
    this.rateLimitMiddleware = new RateLimitMiddleware(this.redis, this.logger);
    
    // 라우터
    this.authRoutes = new AuthRoutes(
      this.authController,
      this.authMiddleware,
      this.rateLimitMiddleware,
      this.logger
    );

    this.logger.info('Services initialized successfully');
  }

  /**
   * 미들웨어 설정
   */
  private setupMiddleware(): void {
    // 보안 헤더
    this.app.use(helmet({
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }));

    // CORS 설정
    this.app.use(cors({
      origin: gatewayConfig.server.cors.origins,
      credentials: gatewayConfig.server.cors.credentials,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Correlation-ID',
        'X-Requested-With'
      ]
    }));

    // 압축
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // 요청 로깅 및 상관관계 ID
    this.app.use(this.requestLoggingMiddleware());

    // 신뢰할 수 있는 프록시 설정 (로드 밸런서 뒤에 있을 때)
    this.app.set('trust proxy', true);
  }

  /**
   * 라우트 설정
   */
  private setupRoutes(): void {
    // 헬스체크
    this.app.get('/health', (req: Request, res: Response) => {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'api-gateway',
        version: '3.1.0'
      });
    });

    // 루트 경로
    this.app.get('/', (req: Request, res: Response) => {
      res.status(200).json({
        message: 'API Gateway - 통합 자동화 시스템 v3.1',
        version: '3.1.0',
        endpoints: {
          auth: '/api/v1/auth',
          health: '/health'
        }
      });
    });

    // 인증 라우트
    this.app.use('/api/v1/auth', this.authRoutes.getRouter());

    // 404 핸들러
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: `Route ${req.method} ${req.originalUrl} not found`,
        timestamp: new Date().toISOString()
      });
    });

    this.logger.info('Routes configured successfully');
  }

  /**
   * 에러 핸들링 설정
   */
  private setupErrorHandling(): void {
    // 전역 에러 핸들러
    this.app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
      this.logger.error('Unhandled error', {
        error: error.message,
        stack: error.stack,
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        correlationId: req.correlationId
      });

      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
        timestamp: new Date().toISOString(),
        correlationId: req.correlationId
      });
    });

    // Process 레벨 에러 핸들링
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught Exception', {
        error: error.message,
        stack: error.stack
      });
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled Rejection', {
        reason,
        promise
      });
    });
  }

  /**
   * 요청 로깅 미들웨어
   */
  private requestLoggingMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // 상관관계 ID 설정
      req.correlationId = req.get('X-Correlation-ID') || uuidv4();
      req.startTime = Date.now();

      // 응답 로깅
      res.on('finish', () => {
        const duration = Date.now() - (req.startTime || 0);
        
        this.logger.info('Request completed', {
          method: req.method,
          url: req.originalUrl,
          statusCode: res.statusCode,
          duration: `${duration}ms`,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          correlationId: req.correlationId,
          userId: req.user?.id
        });
      });

      // 상관관계 ID를 응답 헤더에 추가
      res.set('X-Correlation-ID', req.correlationId);
      
      next();
    };
  }

  /**
   * 서버 시작
   */
  async start(): Promise<void> {
    try {
      // Redis 연결
      await this.redis.connect();

      // 서버 시작
      const server = this.app.listen(gatewayConfig.server.port, gatewayConfig.server.host, () => {
        this.logger.info('Gateway server started', {
          port: gatewayConfig.server.port,
          host: gatewayConfig.server.host,
          environment: gatewayConfig.server.environment,
          cors: gatewayConfig.server.cors.origins
        });
      });

      // Graceful shutdown 처리
      process.on('SIGTERM', () => {
        this.logger.info('SIGTERM received, shutting down gracefully');
        server.close(() => {
          this.redis.disconnect();
          process.exit(0);
        });
      });

      process.on('SIGINT', () => {
        this.logger.info('SIGINT received, shutting down gracefully');
        server.close(() => {
          this.redis.disconnect();
          process.exit(0);
        });
      });

    } catch (error) {
      this.logger.error('Failed to start gateway server', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      process.exit(1);
    }
  }

  /**
   * Express 애플리케이션 인스턴스 반환
   */
  getApp(): Application {
    return this.app;
  }
}