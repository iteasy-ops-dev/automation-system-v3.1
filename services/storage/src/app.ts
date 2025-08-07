/**
 * Prisma 기반 Storage Service 메인 애플리케이션 - 간소화
 * TASK-4-PRISMA: 핵심 기능만 구현 + MCP 마이그레이션 통합
 */

import express = require('express');
import { Router } from 'express';
import { body, query, param } from 'express-validator';

// Prisma 기반 imports
import DatabaseConfig, { prisma } from './config/database';
import RedisConnectionManager, { redis } from './config/redis';
import { StorageService } from './services/storage.service';
import { StorageController } from './controllers/storage.controller';
import { CacheService } from './services/cache.service';
import { EventBusService } from './services/event-bus.service';
import { Logger } from './utils/logger';
import { MCPSchemaMigrator } from './utils/mcp-migrator'; // 마이그레이션 추가
import { createAuthRoutes } from './routes/auth.routes';
import { 
  jsonErrorHandler, 
  globalErrorHandler, 
  notFoundHandler,
  asyncErrorHandler 
} from './middleware/error.middleware';

const app = express();
const logger = new Logger('StorageApp');

// ========== 기본 미들웨어 ==========
// raw body를 먼저 받고 수동으로 JSON 파싱
app.use(express.raw({ type: 'application/json', limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// JSON 파싱 미들웨어
app.use((req, res, next) => {
  if (req.is('application/json') && Buffer.isBuffer(req.body)) {
    try {
      const bodyString = req.body.toString('utf8');
      if (bodyString.trim()) {
        req.body = JSON.parse(bodyString);
      } else {
        req.body = {};
      }
    } catch (error) {
      logger.warn('JSON parsing error', {
        error: (error as Error).message,
        body: req.body.toString('utf8').substring(0, 100),
        url: req.url,
        method: req.method
      });
      
      const errorResponse = {
        success: false,
        error: {
          code: 400,
          message: 'Invalid JSON format',
          details: 'Request body contains malformed JSON',
          timestamp: new Date().toISOString()
        }
      };
      
      return res.status(400).json(errorResponse);
    }
  }
  next();
});

// ========== 서비스 초기화 ==========
let storageController: StorageController;
let authRoutes: Router;

async function initializeServices(): Promise<void> {
  try {
    logger.info('Initializing Storage Service with Prisma...');

    // 1. 데이터베이스 연결 확인
    const dbConnected = await DatabaseConfig.testConnection();
    if (!dbConnected) {
      throw new Error('Database connection failed');
    }
    logger.info('✅ Database (Prisma) connected successfully');

    // 2. Redis 연결 확인  
    const redisConnected = await RedisConnectionManager.testConnection();
    if (!redisConnected) {
      throw new Error('Redis connection failed');
    }
    logger.info('✅ Redis connected successfully');

    // 3. 서비스 인스턴스 생성
    const cacheService = new CacheService(redis);
    
    // 4. EventBus 설정 (환경 변수로 제어)
    let eventBusService = null;
    if (process.env.ENABLE_EVENT_BUS === 'true') {
      try {
        eventBusService = new EventBusService({
          brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
          clientId: 'storage-service',
          groupId: 'storage-service-group'
        });
        await eventBusService.connect();
        logger.info('✅ Event Bus connected successfully');
      } catch (eventBusError) {
        logger.warn('Event Bus connection failed - continuing without events', eventBusError);
        eventBusService = null;
      }
    } else {
      logger.info('ℹ️ Event Bus disabled by configuration');
    }

    // 5. Storage Service 초기화 (Prisma 기반)
    const storageService = new StorageService(prisma, cacheService, eventBusService);
    storageController = new StorageController(storageService);

    // 6. 인증 라우트 생성
    authRoutes = createAuthRoutes(prisma);

    logger.info('✅ All services initialized successfully with Prisma');
  } catch (error) {
    logger.error('Failed to initialize services', error);
    throw error;
  }
}

// ========== 라우트는 초기화 후 등록 ==========
function setupRoutes(): void {
  logger.info('Setting up routes...');
  
  // 인증 API 라우트 (Gateway가 사용)
  logger.info('Registering auth routes at /api/v1/storage/auth');
  app.use('/api/v1/storage/auth', createAuthRoutes(prisma));

  // Storage API 라우트 (계약 100% 준수)
  app.get('/api/v1/storage/devices', 
    async (req, res) => {
      await storageController.getDevices(req, res);
    }
  );

  app.get('/api/v1/storage/devices/:id',
    async (req, res) => {
      await storageController.getDevice(req, res);
    }
  );

  app.post('/api/v1/storage/devices',
    async (req, res) => {
      await storageController.createDevice(req, res);
    }
  );

  app.put('/api/v1/storage/devices/:id',
    async (req, res) => {
      await storageController.updateDevice(req, res);
    }
  );

  app.delete('/api/v1/storage/devices/:id',
    async (req, res) => {
      await storageController.deleteDevice(req, res);
    }
  );

  app.get('/api/v1/storage/devices/by-group/:groupId',
    async (req, res) => {
      await storageController.getDevicesByGroup(req, res);
    }
  );

  app.get('/api/v1/storage/devices/:id/connection-info',
    async (req, res) => {
      await storageController.getDecryptedConnectionInfo(req, res);
    }
  );

  app.delete('/api/v1/storage/cache/flush',
    async (req, res) => {
      await storageController.flushCache(req, res);
    }
  );

  app.get('/api/v1/storage/cache/stats',
    async (req, res) => {
      await storageController.getCacheStats(req, res);
    }
  );

  app.get('/api/v1/storage/stats',
    async (req, res) => {
      await storageController.getSystemStats(req, res);
    }
  );

  app.get('/api/v1/storage/health',
    async (req, res) => {
      await storageController.healthCheck(req, res);
    }
  );
  
  // 기본 라우트
  app.get('/', (req, res) => {
    res.json({
      service: 'Storage Service',
      version: '1.0.0',
      architecture: 'v3.1',
      orm: 'Prisma',
      status: 'healthy',
      timestamp: new Date().toISOString()
    });
  });

  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });

  // 에러 핸들링 미들웨어 (순서 중요: 가장 마지막에 등록)
  
  // 1. 404 핸들러 (모든 라우트 후)
  app.use('*', notFoundHandler);
  
  // 2. 전역 에러 핸들러 (가장 마지막)
  app.use(globalErrorHandler);
  
  logger.info('All routes and error handlers registered successfully');
}

// ========== 서버 시작 ==========

async function startServer(): Promise<void> {
  try {
    // 🔄 MCP 스키마 마이그레이션 먼저 실행 (영구 해결책)
    await MCPSchemaMigrator.applyMCPMigration();
    
    await initializeServices();
    
    // 라우트 설정
    setupRoutes();

    const port = parseInt(process.env.PORT || '8001');
    const host = process.env.HOST || '0.0.0.0';

    app.listen(port, host, () => {
      logger.info(`🚀 Storage Service running on http://${host}:${port}`);
      logger.info('✅ TASK-4-PRISMA: Prisma 전환 완료');
      logger.info('✅ MCP 스키마 마이그레이션 영구 적용');
      logger.info('✅ TypeScript 5.x 완전 호환');
      logger.info('✅ 계약 100% 준수 구현');
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// ========== 그레이스풀 셧다운 ==========

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  try {
    await DatabaseConfig.disconnect();
    await RedisConnectionManager.disconnect();
    logger.info('✅ All connections closed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', error);
    process.exit(1);
  }
});

// 서버 시작
startServer().catch((error) => {
  logger.error('Failed to start application', error);
  process.exit(1);
});

export = app;
