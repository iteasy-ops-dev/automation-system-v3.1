const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const logger = require('./utils/logger');

// 서비스 초기화
const prismaService = require('./services/prisma.service');
const mongoService = require('./services/mongo.service');
const redisService = require('./services/redis.service');
const kafkaService = require('./services/kafka.service');
// WebSocket 핸들러는 런타임에 생성

// 컨트롤러
const workflowController = require('./controllers/workflow.controller');
const healthController = require('./controllers/health.controller');

class WorkflowEngineApp {
  constructor() {
    this.app = express();
    this.server = null;
    this.isShuttingDown = false;
  }

  async initialize() {
    try {
      logger.info('🚀 Workflow Engine Service 초기화 시작...');

      // Express 미들웨어 설정
      this.setupMiddleware();

      // 라우트 설정
      this.setupRoutes();

      // 에러 핸들링 설정
      this.setupErrorHandling();

      // 데이터베이스 연결
      await this.connectDatabases();

      // Kafka 연결
      await this.connectKafka();

      // WebSocket 핸들러 초기화 (Redis 연결 후)
      await this.initializeWebSocketHandler();

      logger.info('✅ Workflow Engine Service 초기화 완료');

    } catch (error) {
      logger.error('❌ Workflow Engine Service 초기화 실패:', error);
      throw error;
    }
  }

  setupMiddleware() {
    // 보안 헤더
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"]
        }
      },
      crossOriginEmbedderPolicy: false
    }));

    // CORS 설정
    this.app.use(cors({
      origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3001'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    // 압축
    this.app.use(compression());

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15분
      max: config.API_RATE_LIMIT || 1000,
      message: {
        error: 'Too many requests from this IP',
        retryAfter: '15 minutes'
      },
      standardHeaders: true,
      legacyHeaders: false
    });
    this.app.use('/api/', limiter);

    // JSON 파싱
    this.app.use(express.json({ 
      limit: '10mb',
      verify: (req, res, buf) => {
        req.rawBody = buf;
      }
    }));

    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // 요청 로깅
    this.app.use((req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info('HTTP Request', {
          method: req.method,
          url: req.originalUrl,
          status: res.statusCode,
          duration: `${duration}ms`,
          userAgent: req.get('User-Agent'),
          ip: req.ip
        });
      });

      next();
    });
  }

  setupRoutes() {
    // 헬스체크 (인증 불필요)
    this.app.use('/health', healthController);

    // API 라우트
    this.app.use('/api/v1/workflows', workflowController);

    // API 버전 정보
    this.app.get('/api/version', (req, res) => {
      res.json({
        service: 'workflow-engine',
        version: '1.0.0',
        architecture: 'v3.1',
        apiVersion: 'v1',
        features: [
          'chat-orchestration',
          'n8n-integration',
          'mcp-nodes',
          'prisma-metadata',
          'mongodb-execution-data'
        ],
        timestamp: new Date().toISOString()
      });
    });

    // 404 핸들러
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        message: 'Endpoint not found',
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString()
      });
    });
  }

  setupErrorHandling() {
    // 전역 에러 핸들러
    this.app.use((error, req, res, next) => {
      logger.error('Unhandled API Error:', {
        error: error.message,
        stack: error.stack,
        url: req.originalUrl,
        method: req.method,
        body: req.body,
        headers: req.headers
      });

      // 개발 환경에서만 스택 트레이스 노출
      const isDevelopment = config.NODE_ENV === 'development';

      res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Internal Server Error',
        ...(isDevelopment && { 
          stack: error.stack,
          details: error.details 
        }),
        timestamp: new Date().toISOString()
      });
    });

    // 처리되지 않은 Promise 거부
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    // 캐치되지 않은 예외
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      this.gracefulShutdown('uncaughtException');
    });

    // 프로세스 종료 시그널
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received');
      this.gracefulShutdown('SIGTERM');
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received');
      this.gracefulShutdown('SIGINT');
    });
  }

  async connectDatabases() {
    try {
      // Prisma 연결
      await prismaService.connect();
      logger.info('✅ Prisma 연결 완료');

      // MongoDB 연결
      await mongoService.connect();
      logger.info('✅ MongoDB 연결 완료');

      // Redis 연결
      await redisService.connect();
      logger.info('✅ Redis 연결 완료');

    } catch (error) {
      logger.error('❌ 데이터베이스 연결 실패:', error);
      throw error;
    }
  }

  async connectKafka() {
    try {
      await kafkaService.connect();
      logger.info('✅ Kafka 연결 완료');
    } catch (error) {
      logger.error('❌ Kafka 연결 실패:', error);
      // Kafka는 선택적 의존성으로 처리
      logger.warn('⚠️ Kafka 없이 서비스 시작 (이벤트 발행 비활성화)');
    }
  }

  async initializeWebSocketHandler() {
    try {
      // Runtime WebSocket 핸들러 생성
      const Redis = require('redis');
      
      // Publisher와 Subscriber 클라이언트 생성
      const publisher = Redis.createClient({
        url: config.REDIS_URL
      });
      
      const subscriber = Redis.createClient({
        url: config.REDIS_URL
      });
      
      await publisher.connect();
      await subscriber.connect();
      
      // workflow:actions 채널 구독
      await subscriber.subscribe('workflow:actions');
      
      logger.info('📡 WebSocket 핸들러: workflow:actions 채널 구독 완료');
      
      // 메시지 핸들러 설정
      subscriber.on('message', async (channel, message) => {
        try {
          const data = JSON.parse(message);
          
          if (channel === 'workflow:actions' && 
              data.type === 'workflow_action' && 
              data.payload?.action === 'chat') {
            
            logger.info('💬 WebSocket 채팅 메시지 수신:', {
              sessionId: data.sessionId,
              message: data.payload.message?.substring(0, 50) + '...',
              userId: data.userId
            });
            
            // 채팅 오케스트레이터 호출
            const chatOrchestrator = require('./services/chat-orchestrator.service');
            
            try {
              const result = await chatOrchestrator.processChat(
                data.payload.sessionId,
                data.payload.message,
                { 
                  ...data.payload.context, 
                  websocketUserId: data.userId, 
                  websocketSessionId: data.sessionId 
                }
              );
              
              logger.info('✅ WebSocket 채팅 처리 완료:', {
                type: result.type,
                status: result.status,
                executionId: result.executionId
              });
              
              // 응답 데이터 생성
              const responseData = {
                type: 'chat_response',
                timestamp: new Date().toISOString(),
                payload: {
                  executionId: result.executionId,
                  workflowId: result.workflowId,
                  status: result.status,
                  message: result.response,
                  type: result.type,
                  duration: result.duration || 0,
                  intent: result.intent || {}
                },
                metadata: {
                  messageId: 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                  correlationId: data.metadata?.messageId,
                  sessionId: data.sessionId,
                  userId: data.userId,
                  version: '1.0.0'
                },
                sessionId: data.sessionId,
                userId: data.userId
              };
              
              // Redis를 통해 Gateway에 응답 전송
              await publisher.publish('chat:responses', JSON.stringify(responseData));
              
              logger.info('📤 WebSocket 응답 전송 완료:', {
                channel: 'chat:responses',
                correlationId: data.metadata?.messageId,
                responseType: result.type
              });
              
            } catch (error) {
              logger.error('❌ WebSocket 채팅 처리 실패:', error);
              
              // 에러 응답 전송
              const errorData = {
                type: 'error',
                timestamp: new Date().toISOString(),
                payload: {
                  errorId: 'err_' + Date.now(),
                  message: '채팅 처리 중 오류가 발생했습니다: ' + error.message,
                  recoverable: true,
                  retryable: true
                },
                metadata: {
                  messageId: 'error_' + Date.now(),
                  correlationId: data.metadata?.messageId,
                  sessionId: data.sessionId,
                  userId: data.userId,
                  version: '1.0.0'
                },
                sessionId: data.sessionId,
                userId: data.userId
              };
              
              await publisher.publish('chat:responses', JSON.stringify(errorData));
              logger.info('📤 WebSocket 에러 응답 전송 완료');
            }
          }
        } catch (error) {
          logger.error('❌ WebSocket 메시지 처리 실패:', error);
        }
      });
      
      // 인스턴스에 저장
      this.webSocketPublisher = publisher;
      this.webSocketSubscriber = subscriber;
      
      logger.info('✅ WebSocket 핸들러 초기화 완료');
      
    } catch (error) {
      logger.error('❌ WebSocket 핸들러 초기화 실패:', error);
      throw error;
    }
  }

  async start() {
    try {
      await this.initialize();

      this.server = this.app.listen(config.PORT, () => {
        logger.info(`🎯 Workflow Engine Service 시작됨`, {
          port: config.PORT,
          environment: config.NODE_ENV,
          version: '1.0.0',
          architecture: 'v3.1',
          pid: process.pid
        });

        // 시작 후 헬스체크
        this.performStartupHealthCheck();
      });

      this.server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          logger.error(`❌ 포트 ${config.PORT}가 이미 사용 중입니다`);
        } else {
          logger.error('❌ 서버 시작 오류:', error);
        }
        process.exit(1);
      });

    } catch (error) {
      logger.error('❌ Workflow Engine Service 시작 실패:', error);
      process.exit(1);
    }
  }

  async performStartupHealthCheck() {
    try {
      logger.info('🔍 시작 후 헬스체크 수행 중...');

      const healthChecks = await Promise.allSettled([
        prismaService.healthCheck(),
        mongoService.healthCheck(),
        redisService.healthCheck()
      ]);

      const results = {
        prisma: healthChecks[0].status === 'fulfilled' ? healthChecks[0].value : { status: 'unhealthy' },
        mongodb: healthChecks[1].status === 'fulfilled' ? healthChecks[1].value : { status: 'unhealthy' },
        redis: healthChecks[2].status === 'fulfilled' ? healthChecks[2].value : { status: 'unhealthy' }
      };

      const healthyServices = Object.values(results).filter(r => r.status === 'healthy').length;
      const totalServices = Object.keys(results).length;

      logger.info(`✅ 시작 후 헬스체크 완료: ${healthyServices}/${totalServices} 서비스 정상`);

      if (healthyServices < totalServices) {
        logger.warn('⚠️ 일부 서비스가 비정상 상태입니다:', results);
      }

    } catch (error) {
      logger.error('❌ 시작 후 헬스체크 실패:', error);
    }
  }

  async gracefulShutdown(signal) {
    if (this.isShuttingDown) {
      logger.warn('이미 종료 프로세스가 진행 중입니다');
      return;
    }

    this.isShuttingDown = true;
    logger.info(`🛑 Graceful shutdown 시작 (${signal})`);

    const shutdownTimeout = setTimeout(() => {
      logger.error('❌ Graceful shutdown 타임아웃, 강제 종료');
      process.exit(1);
    }, 30000); // 30초 타임아웃

    try {
      // HTTP 서버 종료
      if (this.server) {
        await new Promise((resolve) => {
          this.server.close(resolve);
        });
        logger.info('✅ HTTP 서버 종료 완료');
      }

      // WebSocket 클라이언트 해제
      if (this.webSocketPublisher) {
        await this.webSocketPublisher.disconnect();
        logger.info('✅ WebSocket Publisher 해제 완료');
      }
      
      if (this.webSocketSubscriber) {
        await this.webSocketSubscriber.disconnect();
        logger.info('✅ WebSocket Subscriber 해제 완료');
      }
      
      // 데이터베이스 연결 해제
      await Promise.allSettled([
        prismaService.disconnect(),
        mongoService.disconnect(),
        redisService.disconnect(),
        kafkaService.disconnect()
      ]);
      logger.info('✅ 데이터베이스 연결 해제 완료');

      clearTimeout(shutdownTimeout);
      logger.info('✅ Graceful shutdown 완료');
      process.exit(0);

    } catch (error) {
      logger.error('❌ Graceful shutdown 중 오류:', error);
      clearTimeout(shutdownTimeout);
      process.exit(1);
    }
  }
}

module.exports = WorkflowEngineApp;