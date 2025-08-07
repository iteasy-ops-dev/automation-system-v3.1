/**
 * Device Management Service Express Application
 * 계약 기반 REST API 서버
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import { createLogger, config } from '@/utils';
import { 
  CacheService, 
  MetricsService, 
  EventBusService, 
  DeviceManagementService 
} from '@/services';
import { DeviceController, HealthController } from '@/controllers';
import { errorHandler, requestLogger, authMiddleware } from '@/middleware';

export class DeviceManagementApp {
  public app: express.Application;
  private prisma: PrismaClient;
  private cacheService: CacheService;
  private metricsService: MetricsService;
  private eventBusService: EventBusService;
  private deviceService: DeviceManagementService;
  private deviceController: DeviceController;
  private healthController: HealthController;
  private logger = createLogger(config.getConfig().logging);

  constructor() {
    this.app = express();
    this.initializeServices();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private initializeServices(): void {
    // Prisma 클라이언트 초기화
    this.prisma = new PrismaClient({
      log: ['error', 'warn'],
      errorFormat: 'pretty'
    });

    // 캐시 서비스 초기화
    const redisConfig = config.getConfig().redis;
    this.cacheService = new CacheService(redisConfig);

    // 메트릭 서비스 초기화
    const influxConfig = config.getConfig().influxdb;
    this.metricsService = new MetricsService(influxConfig);

    // 이벤트 버스 서비스 초기화
    const kafkaConfig = config.getConfig().kafka;
    this.eventBusService = new EventBusService(kafkaConfig);

    // 비즈니스 서비스 초기화
    this.deviceService = new DeviceManagementService(
      this.prisma,
      this.cacheService,
      this.metricsService,
      this.eventBusService
    );

    // 컨트롤러 초기화
    this.deviceController = new DeviceController(this.deviceService);
    this.healthController = new HealthController(
      this.cacheService,
      this.metricsService,
      this.eventBusService
    );

    this.logger.info('Services initialized successfully');
  }

  private setupMiddleware(): void {
    // 보안 헤더
    this.app.use(helmet({
      contentSecurityPolicy: false // API 서버이므로 CSP 비활성화
    }));

    // CORS 설정
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // 압축
    this.app.use(compression());

    // 요청 로깅
    this.app.use(requestLogger());

    // JSON 파싱
    this.app.use(express.json({ limit: '1mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '1mb' }));

    // Rate limiting
    const rateLimitConfig = config.getConfig().rateLimit;
    this.app.use('/api', rateLimit({
      windowMs: rateLimitConfig.windowMs,
      max: rateLimitConfig.maxRequests,
      message: {
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests',
        timestamp: new Date().toISOString()
      },
      standardHeaders: true,
      legacyHeaders: false
    }));

    this.logger.info('Middleware configured');
  }

  private setupRoutes(): void {
    // Health check
    this.app.use('/health', this.healthController.getRouter());
    
    // API 라우트
    this.app.use('/api/v1/devices', authMiddleware, this.deviceController.getRouter());
    
    // 기본 라우트
    this.app.get('/', (req, res) => {
      res.json({
        service: 'Device Management Service',
        version: '1.0.0',
        status: 'healthy',
        timestamp: new Date().toISOString()
      });
    });

    this.logger.info('Routes configured');
  }

  private setupErrorHandling(): void {
    // 404 핸들러
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Endpoint not found',
        path: req.originalUrl,
        timestamp: new Date().toISOString()
      });
    });

    // 글로벌 에러 핸들러
    this.app.use(errorHandler);

    this.logger.info('Error handling configured');
  }

  async start(port: number = 8101): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = this.app.listen(port, () => {
        this.logger.info(`🚀 Device Management Service running on port ${port}`);
        resolve();
      });

      server.on('error', (error) => {
        this.logger.error('Server start failed:', error);
        reject(error);
      });
    });
  }

  async stop(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      await this.cacheService.disconnect();
      await this.eventBusService.disconnect();
      this.logger.info('Device Management Service stopped');
    } catch (error) {
      this.logger.error('Error stopping service:', error);
      throw error;
    }
  }
}

// 직접 실행 시
if (require.main === module) {
  const app = new DeviceManagementApp();
  const port = parseInt(process.env.PORT || '8101');
  
  app.start(port).catch((error) => {
    console.error('Failed to start Device Management Service:', error);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    await app.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    await app.stop();
    process.exit(0);
  });
}
