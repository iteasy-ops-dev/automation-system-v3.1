// Express 앱 구성 및 라우팅 설정

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { ServiceManager } from './services';
import { ControllerFactory } from './controllers';
import { config, validateConfig } from './utils/config';
import logger from './utils/logger';

export class LLMApp {
  private app: express.Application;
  private serviceManager: ServiceManager;
  private controllers: ControllerFactory;

  constructor() {
    this.app = express();
    this.serviceManager = new ServiceManager();
    this.controllers = new ControllerFactory(this.serviceManager);
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // 보안 헤더
    this.app.use(helmet({
      contentSecurityPolicy: false, // API 서버이므로 비활성화
    }));

    // CORS 설정
    this.app.use(cors({
      origin: (process.env.CORS_ORIGINS || '*').split(','),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id', 'user-id', 'session-id']
    }));

    // JSON 파싱
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // 요청 로깅 미들웨어
    this.app.use((req, res, next) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        logger.info('HTTP Request', {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          userAgent: req.get('User-Agent'),
          ip: req.ip
        });
      });
      
      next();
    });
  }

  private setupRoutes(): void {
    const llmController = this.controllers.getLLMController();
    const healthController = this.controllers.getHealthController();
    const providerController = this.controllers.getProviderController();

    // 헬스체크 라우트 (인증 불필요)
    this.app.get('/health', healthController.health.bind(healthController));
    this.app.get('/ready', healthController.ready.bind(healthController));
    this.app.get('/live', healthController.live.bind(healthController));
    this.app.get('/stats', healthController.stats.bind(healthController));

    // API v1 라우트
    const apiV1 = express.Router();
    
    // Provider 관리 라우트 (이원화된 LLM 관리)
    apiV1.get('/llm/providers', providerController.getProviders.bind(providerController));
    apiV1.get('/llm/providers/:id', providerController.getProvider.bind(providerController));
    apiV1.post('/llm/providers', providerController.createProvider.bind(providerController));
    apiV1.put('/llm/providers/:id', providerController.updateProvider.bind(providerController));
    apiV1.delete('/llm/providers/:id', providerController.deleteProvider.bind(providerController));
    apiV1.post('/llm/providers/:id/set-default', providerController.setDefaultProvider.bind(providerController));
    apiV1.post('/llm/test', providerController.testProvider.bind(providerController));
    apiV1.post('/llm/discover', providerController.discoverModels.bind(providerController));
    apiV1.get('/llm/usage', providerController.getUsage.bind(providerController)); // 사용량 통계 추가
    
    // 이원화된 완성 API
    apiV1.post('/llm/chat/completions', providerController.chatCompletion.bind(providerController));
    apiV1.post('/llm/workflow/completions', providerController.workflowCompletion.bind(providerController));
    
    // 기존 LLM API 라우트 (계약 준수)
    apiV1.post('/llm/chat', llmController.chat.bind(llmController));
    apiV1.post('/llm/stream', llmController.streamChat.bind(llmController));
    apiV1.get('/llm/models', llmController.getModels.bind(llmController));
    // apiV1.get('/llm/usage', llmController.getUsage.bind(llmController)); // Provider Controller로 이동
    apiV1.get('/llm/templates', llmController.getTemplates.bind(llmController));
    apiV1.post('/llm/templates', llmController.createTemplate.bind(llmController));

    this.app.use('/api/v1', apiV1);

    // 기본 라우트
    this.app.get('/', (req, res) => {
      res.json({
        service: 'LLM Service',
        version: '1.0.0',
        description: 'LLM 프로바이더 통합 서비스',
        endpoints: {
          health: '/health',
          api: '/api/v1',
          docs: '/api/v1/docs'
        },
        timestamp: new Date().toISOString()
      });
    });

    // 404 핸들러
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Endpoint not found',
        path: req.originalUrl,
        timestamp: new Date().toISOString()
      });
    });
  }

  private setupErrorHandling(): void {
    // 전역 에러 핸들러
    this.app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
        method: req.method,
        path: req.path,
        body: req.body
      });

      if (res.headersSent) {
        return next(err);
      }

      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'An internal server error occurred',
        timestamp: new Date().toISOString()
      });
    });

    // 처리되지 않은 Promise 거부 핸들러
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Promise Rejection', {
        reason,
        promise
      });
    });

    // 처리되지 않은 예외 핸들러
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', { error });
      process.exit(1);
    });
  }

  async initialize(): Promise<void> {
    try {
      // 환경설정 검증
      validateConfig();
      
      // 서비스 초기화
      await this.serviceManager.initialize();
      
      logger.info('LLM Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize LLM Service', { 
        error: {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          name: error instanceof Error ? error.name : undefined,
          ...(error instanceof Error && 'code' in error ? { code: error.code } : {})
        }
      });
      throw error;
    }
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      const server = this.app.listen(config.port, () => {
        logger.info('LLM Service started', {
          port: config.port,
          environment: process.env.NODE_ENV || 'development',
          pid: process.pid
        });
        resolve();
      });

      // Graceful shutdown
      const gracefulShutdown = async (signal: string) => {
        logger.info(`Received ${signal}, starting graceful shutdown...`);
        
        server.close(async () => {
          try {
            await this.serviceManager.shutdown();
            logger.info('LLM Service shut down gracefully');
            process.exit(0);
          } catch (error) {
            logger.error('Error during shutdown', { error });
            process.exit(1);
          }
        });
      };

      process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
      process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    });
  }

  getApp(): express.Application {
    return this.app;
  }
}
