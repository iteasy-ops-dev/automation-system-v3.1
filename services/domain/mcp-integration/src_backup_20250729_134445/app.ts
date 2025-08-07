/**
 * MCP Integration Service - Main Application
 * Express 서버 설정 및 실행
 * 포트: 8201 (계약에 정의된 포트)
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { MCPIntegrationService } from './services/mcp-integration.service';
import { createMCPRouter } from './routes/mcp.routes';
import { Logger } from './utils/logger';

const logger = new Logger('mcp-app');

export class MCPIntegrationApp {
  private app: express.Application;
  private service: MCPIntegrationService;
  private server: any;

  constructor() {
    this.app = express();
    this.service = new MCPIntegrationService();
  }

  /**
   * 애플리케이션 초기화
   */
  async initialize(): Promise<void> {
    try {
      logger.info('🚀 Initializing MCP Integration Service...');

      // Express 미들웨어 설정
      this.setupMiddleware();

      // 기본 헬스체크 라우트를 먼저 등록 (서비스 초기화 전)
      this.app.get('/health', (req, res) => {
        res.status(200).json({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          service: 'mcp-integration',
          version: process.env.npm_package_version || '1.0.0',
          pid: process.pid,
          uptime: process.uptime(),
          initialized: false  // 아직 완전히 초기화되지 않음
        });
      });

      // 서비스 초기화 (비동기적으로 진행)
      this.initializeServicesAsync();

      // 나머지 라우터 설정
      this.setupRoutes();

      // 에러 핸들링
      this.setupErrorHandling();

      logger.info('✅ MCP Integration Service initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize MCP Integration Service:', error);
      throw error;
    }
  }

  /**
   * 서비스들을 비동기적으로 초기화
   */
  private async initializeServicesAsync(): Promise<void> {
    try {
      await this.service.initialize();
      logger.info('✅ Background services initialized');
    } catch (error) {
      logger.error('❌ Failed to initialize background services:', error);
    }
  }

  /**
   * 서버 시작
   */
  async start(): Promise<void> {
    const port = process.env.MCP_SERVICE_PORT || 8201;
    
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(port, () => {
        logger.info(`🎉 MCP Integration Service started on port ${port}`);
        logger.info(`📖 API Documentation: http://localhost:${port}/api/v1/docs`);
        resolve();
      });

      this.server.on('error', (error: any) => {
        logger.error('❌ Failed to start server:', error);
        reject(error);
      });
    });
  }

  /**
   * 서버 종료
   */
  async stop(): Promise<void> {
    try {
      logger.info('🛑 Shutting down MCP Integration Service...');

      // 서비스 종료
      await this.service.shutdown();

      // HTTP 서버 종료
      if (this.server) {
        await new Promise<void>((resolve) => {
          this.server.close(() => {
            logger.info('✅ HTTP server closed');
            resolve();
          });
        });
      }

      logger.info('✅ MCP Integration Service shut down gracefully');
    } catch (error) {
      logger.error('❌ Error during shutdown:', error);
      throw error;
    }
  }

  /**
   * Express 미들웨어 설정
   */
  private setupMiddleware(): void {
    // 보안 미들웨어
    this.app.use(helmet());

    // CORS 설정
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    // 압축
    this.app.use(compression());

    // JSON 파싱
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // 신뢰할 수 있는 프록시 설정 (로드 밸런서 뒤에서 실행될 때)
    this.app.set('trust proxy', true);
  }

  /**
   * 라우터 설정
   */
  private setupRoutes(): void {
    // 상세 헬스체크 (별도 엔드포인트)
    this.app.get('/health/detailed', async (req, res) => {
      try {
        const health = await this.service.healthCheck();
        res.status(200).json({
          status: 'detailed',
          timestamp: new Date().toISOString(),
          service: 'mcp-integration',
          version: process.env.npm_package_version || '1.0.0',
          ...health
        });
      } catch (error) {
        logger.error('❌ Detailed health check failed:', error);
        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          service: 'mcp-integration',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // API 라우터 연결
    this.app.use('/api/v1/mcp', createMCPRouter(this.service));

    // 404 핸들러
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'ENDPOINT_NOT_FOUND',
        message: `Endpoint ${req.method} ${req.originalUrl} not found`,
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * 에러 핸들링 설정
   */
  private setupErrorHandling(): void {
    // 전역 에러 핸들러
    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('❌ Unhandled error:', err);
      
      if (res.headersSent) {
        return next(err);
      }

      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
        timestamp: new Date().toISOString()
      });
    });

    // Promise rejection 핸들러
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('❌ Unhandled Promise Rejection:', reason);
    });

    // Exception 핸들러
    process.on('uncaughtException', (error) => {
      logger.error('❌ Uncaught Exception:', error);
      process.exit(1);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`📡 Received ${signal}, starting graceful shutdown...`);
      try {
        await this.stop();
        process.exit(0);
      } catch (error) {
        logger.error('❌ Error during graceful shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  }

  /**
   * Express 앱 인스턴스 반환
   */
  getApp(): express.Application {
    return this.app;
  }
}

// 직접 실행된 경우 서버 시작
if (require.main === module) {
  const app = new MCPIntegrationApp();
  
  app.initialize()
    .then(() => app.start())
    .catch((error) => {
      logger.error('❌ Failed to start MCP Integration Service:', error);
      process.exit(1);
    });
}

export default MCPIntegrationApp;
