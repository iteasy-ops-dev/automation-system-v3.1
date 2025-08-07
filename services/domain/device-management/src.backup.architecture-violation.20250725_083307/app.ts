/**
 * Device Management Service - Express App
 * TASK-8 성공 패턴 완전 적용
 * 계약 기반 아키텍처 + Prisma + InfluxDB + Kafka
 */

import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';

// 서비스 및 리포지토리
import { CacheService } from './services/cache.service';
import { EventBusService } from './services/event-bus.service';
import { DeviceRepository, MetricsRepository } from './repositories';
import { DeviceManagementService } from './services/device-management.service';

// 컨트롤러 및 라우트
import { DeviceController } from './controllers/device.controller';
import { createDeviceRoutes } from './routes/device.routes';

// 미들웨어
import { loggingMiddleware } from './middleware/logging';
import { errorMiddleware } from './middleware/error';

// 유틸리티
import { Logger, createLogger } from './utils/logger';
import { Config } from './utils/config';

export class DeviceServiceApp {
  private app: Application;
  private logger: Logger;
  private prisma!: PrismaClient;
  private cacheService!: CacheService;
  private eventBusService!: EventBusService;
  private deviceService!: DeviceManagementService;

  constructor() {
    this.app = express();
    this.logger = createLogger('DeviceService');
  }

  /**
   * 애플리케이션 초기화
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Device Management Service...');

      // 기본 미들웨어 설정
      await this.setupMiddleware();

      // 데이터베이스 및 서비스 초기화
      await this.initializeServices();

      // 라우트 설정
      await this.setupRoutes();

      // 에러 핸들링
      this.setupErrorHandling();

      this.logger.info('Device Management Service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize service', { error });
      throw error;
    }
  }

  /**
   * 기본 미들웨어 설정
   */
  private async setupMiddleware(): Promise<void> {
    // 보안 미들웨어
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS 설정
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    }));

    // 압축
    this.app.use(compression());

    // JSON 파싱
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15분
      max: 100, // 요청 제한
      message: 'Too many requests from this IP',
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use(limiter);

    // 로깅 미들웨어
    this.app.use(loggingMiddleware);

    this.logger.info('Middleware configured successfully');
  }

  /**
   * 서비스 초기화
   */
  private async initializeServices(): Promise<void> {
    // Prisma 클라이언트 초기화
    this.prisma = new PrismaClient();
    await this.prisma.$connect();
    this.logger.info('Database connected successfully');

    // Cache Service 초기화
    const redisUrl = `redis://:${Config.REDIS_PASSWORD}@${Config.REDIS_HOST}:${Config.REDIS_PORT}/${Config.REDIS_DB}`;
    this.cacheService = new CacheService(redisUrl);
    this.logger.info('Cache service connected');

    // Event Bus Service 초기화
    this.eventBusService = new EventBusService();
    await this.eventBusService.connect();
    this.logger.info('Event bus connected');

    // Repository 초기화
    const deviceRepository = new DeviceRepository(this.prisma, this.cacheService, this.logger);
    const metricsRepository = new MetricsRepository(
      this.cacheService,
      this.logger,
      {
        url: Config.INFLUXDB_URL,
        token: Config.INFLUXDB_TOKEN,
        org: Config.INFLUXDB_ORG,
        bucket: Config.INFLUXDB_BUCKET,
      }
    );

    // Device Management Service 초기화
    this.deviceService = new DeviceManagementService(
      deviceRepository,
      metricsRepository,
      this.eventBusService,
      this.logger
    );

    this.logger.info('All services initialized successfully');
  }

  /**
   * 라우트 설정
   */
  private async setupRoutes(): Promise<void> {
    // Health check
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'healthy',
        service: 'device-management',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
      });
    });

    // Device Controller 및 라우트
    const deviceController = new DeviceController(this.deviceService, this.logger);
    this.app.use('/api/v1', createDeviceRoutes(deviceController));

    this.logger.info('Routes configured successfully');
  }

  /**
   * 에러 핸들링 설정
   */
  private setupErrorHandling(): void {
    // 404 핸들러
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: `Route ${req.originalUrl} not found`,
        timestamp: new Date(),
      });
    });

    // 전역 에러 핸들러
    this.app.use(errorMiddleware);
  }

  /**
   * 서버 시작
   */
  async start(port: number = Config.PORT): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const server = this.app.listen(port, () => {
          this.logger.info(`Device Management Service started on port ${port}`);
          resolve();
        });

        // Graceful shutdown
        process.on('SIGTERM', () => this.shutdown(server));
        process.on('SIGINT', () => this.shutdown(server));

      } catch (error) {
        this.logger.error('Failed to start server', { error });
        reject(error);
      }
    });
  }

  /**
   * Graceful shutdown
   */
  private async shutdown(server: any): Promise<void> {
    this.logger.info('Shutting down Device Management Service...');

    try {
      // 서버 종료
      server.close();

      // 연결 정리
      if (this.eventBusService) {
        await this.eventBusService.disconnect();
      }
      if (this.cacheService) {
        await this.cacheService.disconnect();
      }
      if (this.prisma) {
        await this.prisma.$disconnect();
      }

      this.logger.info('Device Management Service shut down gracefully');
      process.exit(0);
    } catch (error) {
      this.logger.error('Error during shutdown', { error });
      process.exit(1);
    }
  }

  /**
   * Express app 반환 (테스트용)
   */
  getApp(): Application {
    return this.app;
  }
}

// 애플리케이션 시작
async function startApplication() {
  const app = new DeviceServiceApp();
  
  try {
    await app.initialize();
    await app.start();
  } catch (error) {
    console.error('Failed to start Device Management Service:', error);
    process.exit(1);
  }
}

// 메인 실행
if (require.main === module) {
  startApplication();
}
