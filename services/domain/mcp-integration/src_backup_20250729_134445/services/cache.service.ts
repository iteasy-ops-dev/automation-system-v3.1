/**
 * Cache Service - MCP Integration Service
 * Redis 기반 캐싱 서비스 - Storage Service 패턴 적용
 */

import Redis from 'ioredis';
import { Logger } from '../utils/logger';

export interface CacheStrategy {
  ttl: number;
  tags?: string[];
  compressionThreshold?: number;
  refreshThreshold?: number;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  avgResponseTime: number;
}

export class CacheService {
  private redis: Redis;
  private logger: Logger;
  private metrics: CacheMetrics;
  private readonly keyPrefix = 'automation:mcp:';

  // MCP 전용 캐시 전략
  private readonly CACHE_STRATEGIES: Record<string, CacheStrategy> = {
    'server:list': { ttl: 300, tags: ['server'], refreshThreshold: 240 },     // 5분
    'server:details': { ttl: 600, tags: ['server'], refreshThreshold: 480 },  // 10분
    'server:status': { ttl: 30, tags: ['server', 'status'], refreshThreshold: 20 }, // 30초
    'tools:catalog': { ttl: 900, tags: ['tools'], refreshThreshold: 720 },    // 15분
    'execution:status': { ttl: 60, tags: ['execution'], refreshThreshold: 45 }, // 1분
    'connection:pool': { ttl: 300, tags: ['connection'], refreshThreshold: 240 } // 5분
  };

  constructor(redisUrl?: string) {
    this.logger = new Logger('cache-service');
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      avgResponseTime: 0
    };

    // Redis 연결 설정
    this.redis = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379', {
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      connectTimeout: 10000,
      commandTimeout: 5000
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.redis.on('connect', () => {
      this.logger.info('Redis connected successfully');
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis connection error', error);
      this.metrics.errors++;
    });

    this.redis.on('ready', () => {
      this.logger.info('Redis ready for operations');
    });
  }

  /**
   * 캐시에서 값 조회
   */
  async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now();
    
    try {
      const fullKey = this.getFullKey(key);
      const value = await this.redis.get(fullKey);
      
      const responseTime = Date.now() - startTime;
      this.updateMetrics('get', responseTime, value !== null);

      if (value === null) {
        this.logger.debug(`Cache miss for key: ${key}`);
        return null;
      }

      this.logger.debug(`Cache hit for key: ${key}`);
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}:`, error);
      this.metrics.errors++;
      return null;
    }
  }

  /**
   * 캐시에 값 저장
   */
  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      const fullKey = this.getFullKey(key);
      const strategy = this.getCacheStrategy(key);
      const cacheTtl = ttl || strategy.ttl;
      
      const serializedValue = JSON.stringify(value);
      await this.redis.setex(fullKey, cacheTtl, serializedValue);
      
      const responseTime = Date.now() - startTime;
      this.updateMetrics('set', responseTime, true);
      
      this.logger.debug(`Cache set for key: ${key}, TTL: ${cacheTtl}s`);
      return true;
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}:`, error);
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * TTL과 함께 캐시 저장 (별칭)
   */
  async setex(key: string, ttl: number, value: any): Promise<boolean> {
    return this.set(key, value, ttl);
  }

  /**
   * 캐시에서 값 삭제
   */
  async del(key: string): Promise<boolean> {
    try {
      const fullKey = this.getFullKey(key);
      const result = await this.redis.del(fullKey);
      
      this.metrics.deletes++;
      this.logger.debug(`Cache delete for key: ${key}`);
      
      return result > 0;
    } catch (error) {
      this.logger.error(`Cache delete error for key ${key}:`, error);
      this.metrics.errors++;
      return false;
    }
  }

  /**
   * 키 존재 여부 확인
   */
  async exists(key: string): Promise<boolean> {
    try {
      const fullKey = this.getFullKey(key);
      const result = await this.redis.exists(fullKey);
      return result === 1;
    } catch (error) {
      this.logger.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * 키의 TTL 조회
   */
  async ttl(key: string): Promise<number> {
    try {
      const fullKey = this.getFullKey(key);
      return await this.redis.ttl(fullKey);
    } catch (error) {
      this.logger.error(`Cache TTL error for key ${key}:`, error);
      return -1;
    }
  }

  /**
   * 패턴으로 키 삭제
   */
  async deleteByPattern(pattern: string): Promise<number> {
    try {
      const fullPattern = this.getFullKey(pattern);
      const keys = await this.redis.keys(fullPattern);
      
      if (keys.length === 0) {
        return 0;
      }
      
      const result = await this.redis.del(...keys);
      this.metrics.deletes += result;
      
      this.logger.info(`Deleted ${result} keys matching pattern: ${pattern}`);
      return result;
    } catch (error) {
      this.logger.error(`Cache delete by pattern error for ${pattern}:`, error);
      this.metrics.errors++;
      return 0;
    }
  }

  /**
   * MCP 서버별 캐시 무효화
   */
  async invalidateServerCache(serverId: string): Promise<void> {
    const patterns = [
      `server:${serverId}:*`,
      `tools:${serverId}:*`,
      `execution:${serverId}:*`,
      'server:list',
      'tools:catalog'
    ];

    for (const pattern of patterns) {
      await this.deleteByPattern(pattern);
    }

    this.logger.info(`Invalidated cache for server: ${serverId}`);
  }

  /**
   * 태그 기반 캐시 무효화
   */
  async invalidateByTag(tag: string): Promise<void> {
    const patterns = Object.keys(this.CACHE_STRATEGIES)
      .filter(key => {
        const strategy = this.CACHE_STRATEGIES[key];
        return strategy.tags?.includes(tag);
      })
      .map(key => `${key}:*`);

    for (const pattern of patterns) {
      await this.deleteByPattern(pattern);
    }

    this.logger.info(`Invalidated cache by tag: ${tag}`);
  }

  /**
   * 캐시 메트릭스 조회
   */
  getMetrics(): CacheMetrics {
    const totalRequests = this.metrics.hits + this.metrics.misses;
    return {
      ...this.metrics,
      avgResponseTime: totalRequests > 0 ? this.metrics.avgResponseTime / totalRequests : 0
    };
  }

  /**
   * 캐시 상태 조회
   */
  async getStats(): Promise<any> {
    try {
      const info = await this.redis.info('memory');
      const keyCount = await this.redis.dbsize();
      
      return {
        connected: this.redis.status === 'ready',
        keyCount,
        memory: this.parseMemoryInfo(info),
        metrics: this.getMetrics()
      };
    } catch (error) {
      this.logger.error('Failed to get cache stats:', error);
      return null;
    }
  }

  /**
   * 연결 종료
   */
  async disconnect(): Promise<void> {
    try {
      await this.redis.quit();
      this.logger.info('Redis connection closed');
    } catch (error) {
      this.logger.error('Error closing Redis connection:', error);
    }
  }

  // Private methods
  private getFullKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  private getCacheStrategy(key: string): CacheStrategy {
    const strategyKey = key.split(':')[0];
    return this.CACHE_STRATEGIES[strategyKey] || { ttl: 300 }; // 기본 5분
  }

  private updateMetrics(operation: 'get' | 'set', responseTime: number, success: boolean): void {
    if (operation === 'get') {
      if (success) {
        this.metrics.hits++;
      } else {
        this.metrics.misses++;
      }
    } else if (operation === 'set') {
      this.metrics.sets++;
    }

    this.metrics.avgResponseTime += responseTime;
  }

  private parseMemoryInfo(info: string): any {
    const lines = info.split('\r\n');
    const memory: any = {};
    
    lines.forEach(line => {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        if (key.includes('memory')) {
          memory[key] = value;
        }
      }
    });
    
    return memory;
  }
}