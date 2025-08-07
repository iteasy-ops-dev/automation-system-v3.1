const Redis = require('redis');
const logger = require('../utils/logger');
const config = require('../config');

class RedisService {
  constructor() {
    this.client = null;
    this.subscriber = null; // 구독 전용 클라이언트
    this.publisher = null;  // 발행 전용 클라이언트
    this.isConnected = false;
    this.messageHandlers = new Map(); // 메시지 핸들러 저장
  }

  async connect() {
    try {
      // 메인 클라이언트 (일반 작업용)
      this.client = Redis.createClient({
        url: config.REDIS_URL,
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            logger.error('Redis 서버가 연결을 거부했습니다');
            return new Error('Redis 서버가 연결을 거부했습니다');
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            logger.error('Redis 재시도 시간 초과');
            return new Error('재시도 시간 초과');
          }
          if (options.attempt > 10) {
            logger.error('Redis 재시도 횟수 초과');
            return undefined;
          }
          return Math.min(options.attempt * 100, 3000);
        }
      });

      // 구독 전용 클라이언트
      this.subscriber = Redis.createClient({
        url: config.REDIS_URL
      });

      // 발행 전용 클라이언트
      this.publisher = Redis.createClient({
        url: config.REDIS_URL
      });

      // 에러 핸들러 설정
      [this.client, this.subscriber, this.publisher].forEach(client => {
        client.on('error', (err) => {
          logger.error('Redis 클라이언트 오류:', err);
        });
      });

      this.client.on('connect', () => {
        logger.info('✅ Redis 메인 클라이언트 연결 성공');
      });

      this.client.on('ready', () => {
        this.isConnected = true;
        logger.info('✅ Redis 메인 클라이언트 준비 완료');
      });

      this.client.on('end', () => {
        this.isConnected = false;
        logger.info('🔌 Redis 메인 클라이언트 연결 해제');
      });

      // 모든 클라이언트 연결
      await Promise.all([
        this.client.connect(),
        this.subscriber.connect(),
        this.publisher.connect()
      ]);

      logger.info('✅ Redis 모든 클라이언트 연결 완료');

      // 구독 메시지 핸들러 설정
      this.setupSubscriptionHandlers();
    } catch (error) {
      logger.error('❌ Redis 연결 실패:', error);
      throw error;
    }
  }

  async disconnect() {
    try {
      const clients = [this.client, this.subscriber, this.publisher].filter(Boolean);
      if (clients.length > 0) {
        await Promise.all(clients.map(client => client.quit()));
        this.isConnected = false;
        logger.info('✅ Redis 모든 클라이언트 연결 해제 완료');
      }
    } catch (error) {
      logger.error('❌ Redis 연결 해제 실패:', error);
    }
  }

  /**
   * 구독 메시지 핸들러 설정
   */
  setupSubscriptionHandlers() {
    this.subscriber.on('message', (channel, message) => {
      try {
        const data = JSON.parse(message);
        logger.debug('📨 Redis 메시지 수신:', { channel, type: data.type });
        
        // 채널별 핸들러 실행
        const handlers = this.messageHandlers.get(channel);
        if (handlers) {
          handlers.forEach(handler => {
            try {
              handler(data);
            } catch (error) {
              logger.error('❌ 메시지 핸들러 실행 실패:', error);
            }
          });
        }
      } catch (error) {
        logger.error('❌ 메시지 파싱 실패:', { channel, error });
      }
    });

    // 기본 구독 채널들
    this.subscribeToChannels(['workflow:actions', 'chat:responses']);
  }

  /**
   * 채널 구독
   */
  async subscribeToChannels(channels) {
    try {
      await this.subscriber.subscribe(channels);
      logger.info('✅ 채널 구독 완료:', channels);
    } catch (error) {
      logger.error('❌ 채널 구독 실패:', error);
      throw error;
    }
  }

  /**
   * 메시지 핸들러 등록
   */
  onMessage(channel, handler) {
    if (!this.messageHandlers.has(channel)) {
      this.messageHandlers.set(channel, new Set());
    }
    this.messageHandlers.get(channel).add(handler);
    logger.debug('✅ 메시지 핸들러 등록:', channel);
  }

  /**
   * 메시지 발행
   */
  async publish(channel, data) {
    try {
      await this.publisher.publish(channel, JSON.stringify(data));
      logger.debug('📤 Redis 메시지 발행:', { channel, type: data.type });
    } catch (error) {
      logger.error('❌ 메시지 발행 실패:', error);
      throw error;
    }
  }

  async healthCheck() {
    try {
      const result = await this.client.ping();
      return { status: 'healthy', ping: result, timestamp: new Date().toISOString() };
    } catch (error) {
      logger.error('❌ Redis 헬스체크 실패:', error);
      return { status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() };
    }
  }

  // 키 생성 헬퍼
  key(type, id) {
    return `${config.REDIS_PREFIX}${type}:${id}`;
  }

  // 워크플로우 실행 상태 캐싱
  async setExecutionStatus(executionId, status, progress = 0, currentStep = null, ttl = 3600) {
    try {
      const key = this.key('execution', executionId);
      
      // Redis hSet requires flat key-value pairs
      await this.client.hSet(key, {
        'status': status,
        'progress': progress?.toString() || '0',
        'currentStep': currentStep?.toString() || '',
        'updatedAt': new Date().toISOString()
      });
      await this.client.expire(key, ttl);
      
      logger.debug(`실행 상태 캐시 저장: ${executionId} -> ${status}`);
    } catch (error) {
      logger.error('❌ 실행 상태 캐시 저장 실패:', error);
      throw error;
    }
  }

  async getExecutionStatus(executionId) {
    try {
      const key = this.key('execution', executionId);
      const data = await this.client.hGetAll(key);
      
      if (Object.keys(data).length === 0) {
        return null;
      }
      
      return data;
    } catch (error) {
      logger.error('❌ 실행 상태 캐시 조회 실패:', error);
      throw error;
    }
  }

  // 워크플로우 정의 캐싱
  async setWorkflowDefinition(workflowId, definition, ttl = 21600) { // 6시간
    try {
      const key = this.key('definition', workflowId);
      await this.client.setEx(key, ttl, JSON.stringify(definition));
      
      logger.debug(`워크플로우 정의 캐시 저장: ${workflowId}`);
    } catch (error) {
      logger.error('❌ 워크플로우 정의 캐시 저장 실패:', error);
      throw error;
    }
  }

  async getWorkflowDefinition(workflowId) {
    try {
      const key = this.key('definition', workflowId);
      const data = await this.client.get(key);
      
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('❌ 워크플로우 정의 캐시 조회 실패:', error);
      throw error;
    }
  }

  // 채팅 세션 워크플로우 매핑
  async addSessionExecution(sessionId, executionId, ttl = 3600) {
    try {
      const key = this.key('session', sessionId);
      await this.client.lPush(key, executionId);
      await this.client.expire(key, ttl);
      
      logger.debug(`세션 실행 매핑 추가: ${sessionId} -> ${executionId}`);
    } catch (error) {
      logger.error('❌ 세션 실행 매핑 추가 실패:', error);
      throw error;
    }
  }

  async getSessionExecutions(sessionId, limit = 10) {
    try {
      const key = this.key('session', sessionId);
      const executions = await this.client.lRange(key, 0, limit - 1);
      
      return executions;
    } catch (error) {
      logger.error('❌ 세션 실행 조회 실패:', error);
      throw error;
    }
  }

  // 일반적인 캐시 메서드
  async set(key, value, ttl = 3600) {
    try {
      const fullKey = this.key('cache', key);
      const serializedValue = typeof value === 'object' ? JSON.stringify(value) : value;
      await this.client.setEx(fullKey, ttl, serializedValue);
    } catch (error) {
      logger.error('❌ 캐시 저장 실패:', error);
      throw error;
    }
  }

  async get(key) {
    try {
      const fullKey = this.key('cache', key);
      const value = await this.client.get(fullKey);
      
      if (!value) return null;
      
      // JSON 파싱 시도
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    } catch (error) {
      logger.error('❌ 캐시 조회 실패:', error);
      throw error;
    }
  }

  async del(key) {
    try {
      const fullKey = this.key('cache', key);
      await this.client.del(fullKey);
    } catch (error) {
      logger.error('❌ 캐시 삭제 실패:', error);
      throw error;
    }
  }

  // 세션별 실행 기록 관리 (TASK-WF-001에서 필요)
  async addSessionExecution(sessionId, executionId) {
    try {
      const sessionKey = this.key('session-executions', sessionId);
      await this.client.lpush(sessionKey, executionId);
      await this.client.expire(sessionKey, 24 * 60 * 60); // 24시간 만료
      logger.debug(`✅ 세션 실행 기록 추가: ${sessionId} -> ${executionId}`);
    } catch (error) {
      logger.error('❌ 세션 실행 기록 추가 실패:', error);
      throw error;
    }
  }

  // 세션별 실행 기록 조회
  async getSessionExecutions(sessionId, limit = 10) {
    try {
      const sessionKey = this.key('session-executions', sessionId);
      const executions = await this.client.lrange(sessionKey, 0, limit - 1);
      return executions;
    } catch (error) {
      logger.error('❌ 세션 실행 기록 조회 실패:', error);
      throw error;
    }
  }

  // 세션 진행 상황 저장 (TASK-WF-001에서 필요)
  async setSessionProgress(sessionId, progressData) {
    try {
      const progressKey = this.key('session-progress', sessionId);
      await this.client.setex(progressKey, 300, JSON.stringify(progressData)); // 5분 만료
      logger.debug(`✅ 세션 진행 상황 저장: ${sessionId}`);
    } catch (error) {
      logger.error('❌ 세션 진행 상황 저장 실패:', error);
      throw error;
    }
  }

  // 세션 진행 상황 조회
  async getSessionProgress(sessionId) {
    try {
      const progressKey = this.key('session-progress', sessionId);
      const progress = await this.client.get(progressKey);
      return progress ? JSON.parse(progress) : null;
    } catch (error) {
      logger.error('❌ 세션 진행 상황 조회 실패:', error);
      throw error;
    }
  }

}

// 싱글톤 인스턴스
const redisService = new RedisService();

module.exports = redisService;