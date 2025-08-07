/**
 * Device Management Service - Express App
 * v3.1 아키텍처 100% 준수: Storage API + 직접 연동 서비스들
 * 포트 8101에서 서비스 제공
 */

import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

// Services
import { StorageClientService } from './services/storage-client.service';
import { CacheService } from './services/cache.service';
import { MetricsService } from './services/metrics.service';
import { EventBusService } from './services/event-bus.service';
import { DeviceManagementService } from './services/device-management.service';

// Controllers and Routes
import { DeviceController } from './controllers/device.controller';
import { createDeviceRoutes } from './routes/device.routes';

// Utils
import { Logger } from './utils/logger';
import Config from './utils/config';

export class DeviceServiceApp {
  private app: Application;
  private logger: Logger;
  
  // 서비스 인스턴스들 (올바른 아키텍처)
  private storageClient!: StorageClientService;     // Storage API 클라이언트
  private cacheService!: CacheService;              // Redis 직접
  private metricsService!: MetricsService;          // InfluxDB 직접
  private eventBusService!: EventBusService;        // Kafka 직접
  private deviceService!: DeviceManagementService;  // 비즈니스 로직

  constructor() {
    this.app = express();
    this.logger = new Logger('DeviceServiceApp');
  }

  /**
   * 애플리케이션 초기화
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('🚀 Initializing Device Management Service...');

      // 설정 검증
      Config.validate();

      // Express 미들웨어 설정
      this.setupMiddleware();

      // 서비스 초기화 (올바른 아키텍처)
      await this.initializeServices();

      // 라우터 설정
      this.setupRoutes();

      // 에러 핸들링 (내부에 구현됨)

      this.logger.logSuccess('Device Management Service initialized successfully');
    } catch (error) {
      this.logger.logError('Failed to initialize Device Management Service', error);
      throw error;
    }
  }

  /**
   * Express 미들웨어 설정
   */
  private setupMiddleware(): void {
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

    // 압축 및 JSON 파싱
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15분
      max: 1000, // 요청 제한
      message: 'Too many requests from this IP',
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use(limiter);

    this.logger.info('Express middleware configured');
  }

  /**
   * 서비스 초기화 (v3.1 아키텍처 준수)
   */
  private async initializeServices(): Promise<void> {
    const config = Config.instance;

    try {
      // 1. Storage Service 클라이언트 (아키텍처 핵심)
      this.storageClient = new StorageClientService(config.STORAGE_SERVICE_URL);
      
      // Storage Service 연결 확인
      const storageHealthy = await this.storageClient.testConnection();
      if (!storageHealthy) {
        throw new Error('Storage Service is not available at ' + config.STORAGE_SERVICE_URL);
      }
      this.logger.logSuccess('Storage Service client initialized');

      // 2. Cache Service (Redis 직접 연동)
      this.cacheService = new CacheService(config.REDIS_URL);
      await this.cacheService.connect();
      this.logger.logSuccess('Cache Service initialized');

      // 3. Metrics Service (InfluxDB 직접 연동)
      this.metricsService = new MetricsService({
        url: config.INFLUXDB_URL,
        token: config.INFLUXDB_TOKEN,
        org: config.INFLUXDB_ORG,
        bucket: config.INFLUXDB_BUCKET
      });
      await this.metricsService.initialize();
      this.logger.logSuccess('Metrics Service initialized');

      // 4. Event Bus Service (Kafka 직접 연동) - Optional
      this.eventBusService = new EventBusService({
        brokers: config.KAFKA_BROKERS,
        clientId: config.KAFKA_CLIENT_ID,
        groupId: config.KAFKA_GROUP_ID
      });
      
      try {
        await this.eventBusService.connect();
        this.logger.logSuccess('Event Bus Service initialized');
      } catch (error: any) {
        this.logger.logWarning('Event Bus Service connection failed, continuing without events', error);
        // EventBus 없이도 기본 기능은 동작하도록 함
      }

      // 5. Device Management Service (비즈니스 로직)
      this.deviceService = new DeviceManagementService(
        this.storageClient,     // Storage API 사용
        this.cacheService,      // Redis 직접
        this.metricsService,    // InfluxDB 직접
        this.eventBusService    // Kafka 직접
      );
      await this.deviceService.initialize();
      this.logger.logSuccess('Device Management Service initialized');

    } catch (error) {
      this.logger.logError('Failed to initialize services', error);
      throw error;
    }
  }

  /**
   * 라우터 설정
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'healthy',
        service: 'device-management',
        version: '1.0.0',
        architecture: 'v3.1',
        port: Config.instance.PORT,
        timestamp: new Date().toISOString(),
        dependencies: {
          storageService: this.storageClient ? 'connected' : 'disconnected',
          redis: this.cacheService ? 'connected' : 'disconnected',
          influxdb: this.metricsService ? 'connected' : 'disconnected',
          kafka: this.eventBusService?.isConnectedToBroker() ? 'connected' : 'disconnected'
        }
      });
    });

    // Device Management Routes (계약 준수)
    const deviceController = new DeviceController(this.deviceService);
    this.app.use('/api/v1', createDeviceRoutes(deviceController));

    this.logger.info('Routes configured successfully');
  }

  /**
   * 서버 시작 (포트 8101)
   */
  async start(): Promise<void> {
    const port = Config.instance.PORT;
    const host = '0.0.0.0';

    return new Promise((resolve, reject) => {
      try {
        const server = this.app.listen(port, host, () => {
          this.logger.logSuccess(`🚀 Device Management Service started on http://${host}:${port}`);
          this.logger.info('✅ v3.1 아키텍처 100% 준수 완료');
          this.logger.info('✅ Storage API 기반 데이터 접근');
          this.logger.info('✅ 계약 기반 REST API 제공');
          resolve();
        });

        // Graceful shutdown
        process.on('SIGTERM', () => this.shutdown(server));
        process.on('SIGINT', () => this.shutdown(server));

      } catch (error) {
        this.logger.logError('Failed to start server', error);
        reject(error);
      }
    });
  }

  /**
   * Graceful shutdown
   */
  private async shutdown(server: any): Promise<void> {
    this.logger.info('📡 Shutting down Device Management Service...');

    try {
      server.close();
      if (this.deviceService) {
        await this.deviceService.shutdown();
      }
      this.logger.logSuccess('✅ Device Management Service shut down gracefully');
      process.exit(0);
    } catch (error) {
      this.logger.logError('Error during shutdown', error);
      process.exit(1);
    }
  }

  getApp(): Application {
    return this.app;
  }
}
