/**
 * Services Index - 모든 서비스 관리
 */

import logger from '../utils/logger';
import { CacheService } from './cache.service';
import { EventService } from './event.service';
import { MongoService } from './mongo.service';
import { PostgresService } from './postgres.service';
import { LLMService } from './llm.service';
import { ProviderService } from './provider.service';

export class ServiceManager {
  private cacheService: CacheService;
  private eventService: EventService;
  private mongoService: MongoService;
  private postgresService: PostgresService;
  private llmService?: LLMService; // 초기화 후 생성
  private providerService?: ProviderService; // 초기화 후 생성

  constructor() {
    // 서비스 초기화 순서 중요
    this.cacheService = new CacheService();
    this.eventService = new EventService();
    this.mongoService = new MongoService();
    this.postgresService = new PostgresService();
    
    // LLM Service와 Provider Service는 initialize()에서 생성
  }

  /**
   * 모든 서비스 초기화
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing services...');

      // 병렬로 초기화 가능한 서비스들
      await Promise.all([
        this.mongoService.connect(),
        this.postgresService.connect(),
        this.cacheService.connect(),
        this.eventService.connect(),
      ]);

      // MongoDB 연결 후 Provider Service 초기화
      this.providerService = new ProviderService(
        this.mongoService,
        this.cacheService
      );
      
      // Provider Service가 준비된 후 LLM Service 초기화
      this.llmService = new LLMService(
        this.cacheService,
        this.eventService,
        this.mongoService,
        this.postgresService,
        this.providerService
      );
      
      // LLM Service Provider 초기화
      await this.llmService.initializeProviders();

      logger.info('All services initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize services:', error);
      throw error;
    }
  }

  /**
   * 모든 서비스 종료
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down services...');

      await Promise.all([
        this.eventService.disconnect(),
        this.cacheService.disconnect(),
        this.mongoService.disconnect(),
        this.postgresService.disconnect(),
      ]);

      logger.info('All services shut down successfully');
    } catch (error) {
      logger.error('Error during shutdown:', error);
      throw error;
    }
  }

  // Getter 메서드들
  getCacheService(): CacheService {
    return this.cacheService;
  }

  getEventService(): EventService {
    return this.eventService;
  }

  getMongoService(): MongoService {
    return this.mongoService;
  }

  getPostgresService(): PostgresService {
    return this.postgresService;
  }

  getLLMService(): LLMService {
    if (!this.llmService) {
      throw new Error('LLM service not initialized. Call initialize() first.');
    }
    return this.llmService;
  }
  
  getProviderService(): ProviderService {
    if (!this.providerService) {
      throw new Error('Provider service not initialized. Call initialize() first.');
    }
    return this.providerService;
  }
}

// 개별 서비스 export
export { CacheService } from './cache.service';
export { EventService } from './event.service';
export { MongoService } from './mongo.service';
export { PostgresService } from './postgres.service';
export { LLMService } from './llm.service';
export { ProviderService } from './provider.service';
