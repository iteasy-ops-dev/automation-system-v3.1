/**
 * Cache Service - 완전한 구현
 * Redis 기반 캐싱 서비스 - Storage Service 완전 호환
 * TASK-4-PRISMA: 모든 필요 메서드 구현
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

export interface CacheStats {
  hitRate: number;
  totalHits: number;
  totalMisses: number;
  totalRequests: number;
  connectedClients: number;
  usedMemory: number;
  maxMemory: number;
  keyCount: number;
  uptime: number;
}

export class CacheService {
  private redis: Redis;
  private logger: Logger;
  private metrics: CacheMetrics;
  private startTime: number;

  // 캐시 전략 정의
  private readonly CACHE_STRATEGIES: Record<string, CacheStrategy> = {
    'api:device': { ttl: 60, tags: ['device'], refreshThreshold: 50 },
    'api:devices:list': { ttl: 30, tags: ['device', 'list'], refreshThreshold: 20 },
    'device:status': { ttl: 300, tags: ['device', 'status'], refreshThreshold: 240 },
    'device:metrics': { ttl: 60, tags: ['device', 'metrics'], refreshThreshold: 45 },
    'session': { ttl: 3600, tags: ['session'], refreshThreshold: 3000 },
    'temp': { ttl: 300, tags: ['temp'] }
  };

  constructor(redis: Redis) {
    this.redis = redis;
    this.logger = new Logger('CacheService');
    this.startTime = Date.now();
    
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      avgResponseTime: 0
    };

    this.setupEventHandlers();
  }

  /**
   * Redis 이벤트 핸들러 설정
   */
  private setupEventHandlers(): void {
    this.redis.on('error', (error: Error) => {
      this.metrics.errors++;
      this.logger.error('Redis error', { error: error.message });
    });

    this.redis.on('connect', () => {
      this.logger.info('Redis connected');
    });

    this.redis.on('disconnect', () => {
      this.logger.warn('Redis disconnected');
    });
  }

  /**
   * 값 조회
   */
  async get<T = any>(key: string): Promise<T | null> {
    const startTime = Date.now();
    
    try {
      const value = await this.redis.get(key);
      const duration = Date.now() - startTime;
      
      this.updateResponseTime(duration);
      
      if (value === null) {
        this.metrics.misses++;
        this.logger.debug('Cache miss', { key });
        return null;
      }

      this.metrics.hits++;
      
      const result = this.deserialize<T>(value);
      this.logger.debug('Cache hit', { key });
      
      return result;
    } catch (error) {
      this.metrics.errors++;
      this.logger.error('Cache get failed', { key, error });
      return null;
    }
  }

  /**
   * 값 설정
   */
  async set<T = any>(key: string, value: T, customTtl?: number): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      const strategy = this.getStrategy(key);
      const ttl = customTtl || strategy.ttl;
      
      const serializedValue = this.serialize(value);

      await this.redis.setex(key, ttl, serializedValue);
      
      this.metrics.sets++;
      
      const duration = Date.now() - startTime;
      this.updateResponseTime(duration);

      this.logger.debug('Cache set', { key, ttl });
      
      return true;
    } catch (error) {
      this.metrics.errors++;
      this.logger.error('Cache set failed', { key, error });
      return false;
    }
  }

  /**
   * setex - Storage Service 호환성
   */
  async setex(key: string, seconds: number, value: any): Promise<void> {
    await this.set(key, value, seconds);
  }

  /**
   * 키 삭제
   */
  async del(key: string): Promise<boolean> {
    try {
      const result = await this.redis.del(key);
      this.metrics.deletes++;
      this.logger.debug('Cache delete', { key, deleted: result > 0 });
      return result > 0;
    } catch (error) {
      this.metrics.errors++;
      this.logger.error('Cache delete failed', { key, error });
      return false;
    }
  }

  /**
   * 패턴 기반 키 삭제 - Storage Service 호환성
   */
  async delPattern(pattern: string): Promise<number> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }

      const result = await this.redis.del(...keys);
      this.metrics.deletes += result;
      this.logger.debug('Pattern delete', { pattern, deleted: result });
      return result;
    } catch (error) {
      this.metrics.errors++;
      this.logger.error('Pattern delete failed', { pattern, error });
      return 0;
    }
  }

  /**
   * 모든 캐시 삭제 - Storage Service 호환성
   */
  async flushAll(): Promise<void> {
    try {
      await this.redis.flushall();
      this.logger.info('All cache flushed');
    } catch (error) {
      this.metrics.errors++;
      this.logger.error('Flush all failed', { error });
      throw error;
    }
  }

  /**
   * Redis 연결 상태 확인 - Storage Service 호환성
   */
  async ping(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      this.logger.error('Redis ping failed', { error });
      return false;
    }
  }

  /**
   * 캐시 통계 조회 - Storage Service 호환성
   */
  async getStats(): Promise<CacheStats> {
    try {
      const info = await this.redis.info();
      const keyspace = await this.redis.info('keyspace');
      
      // Redis INFO 파싱
      const parseInfo = (infoStr: string): Record<string, any> => {
        const result: Record<string, any> = {};
        infoStr.split('\r\n').forEach(line => {
          if (line.includes(':')) {
            const [key, value] = line.split(':');
            result[key] = isNaN(Number(value)) ? value : Number(value);
          }
        });
        return result;
      };

      const infoData = parseInfo(info);
      const keyspaceData = parseInfo(keyspace);
      
      const totalRequests = this.metrics.hits + this.metrics.misses;
      const hitRate = totalRequests > 0 ? this.metrics.hits / totalRequests : 0;

      const stats: CacheStats = {
        hitRate: Math.round(hitRate * 100) / 100,
        totalHits: this.metrics.hits,
        totalMisses: this.metrics.misses,
        totalRequests,
        connectedClients: infoData.connected_clients || 0,
        usedMemory: infoData.used_memory || 0,
        maxMemory: infoData.maxmemory || 0,
        keyCount: keyspaceData['db0']?.split(',')[0]?.split('=')[1] ? 
                  parseInt(keyspaceData['db0'].split(',')[0].split('=')[1]) : 0,
        uptime: Math.floor((Date.now() - this.startTime) / 1000)
      };

      return stats;
    } catch (error) {
      this.logger.error('Failed to get cache stats', { error });
      throw error;
    }
  }

  /**
   * 해시 필드 설정
   */
  async hset(key: string, field: string, value: any, customTtl?: number): Promise<boolean> {
    try {
      const strategy = this.getStrategy(key);
      const serializedValue = this.serialize(value);
      
      await this.redis.hset(key, field, serializedValue);
      
      if (customTtl || strategy.ttl) {
        await this.redis.expire(key, customTtl || strategy.ttl);
      }

      this.logger.debug('Hash field set', { key, field });
      return true;
    } catch (error) {
      this.metrics.errors++;
      this.logger.error('Hash set failed', { key, field, error });
      return false;
    }
  }

  /**
   * 해시 필드 조회
   */
  async hget<T = any>(key: string, field: string): Promise<T | null> {
    try {
      const value = await this.redis.hget(key, field);
      
      if (value === null) {
        this.metrics.misses++;
        return null;
      }

      this.metrics.hits++;
      return this.deserialize<T>(value);
    } catch (error) {
      this.metrics.errors++;
      this.logger.error('Hash get failed', { key, field, error });
      return null;
    }
  }

  /**
   * 여러 키 조회
   */
  async mget<T = any>(keys: string[]): Promise<(T | null)[]> {
    try {
      const values = await this.redis.mget(...keys);
      
      return values.map((value, index) => {
        if (value === null) {
          this.metrics.misses++;
          return null;
        }
        
        this.metrics.hits++;
        return this.deserialize<T>(value);
      });
    } catch (error) {
      this.metrics.errors++;
      this.logger.error('Multi get failed', { keys, error });
      return keys.map(() => null);
    }
  }

  /**
   * 키 존재 여부 확인
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error('Exists check failed', { key, error });
      return false;
    }
  }

  /**
   * TTL 조회
   */
  async ttl(key: string): Promise<number> {
    try {
      return await this.redis.ttl(key);
    } catch (error) {
      this.logger.error('TTL check failed', { key, error });
      return -1;
    }
  }

  /**
   * 캐시 전략 조회
   */
  private getStrategy(key: string): CacheStrategy {
    for (const [pattern, strategy] of Object.entries(this.CACHE_STRATEGIES)) {
      if (key.startsWith(pattern)) {
        return strategy;
      }
    }
    
    // 기본 전략
    return { ttl: 300, tags: ['default'] };
  }

  /**
   * 값 직렬화
   */
  private serialize(value: any): string {
    if (typeof value === 'string') {
      return value;
    }
    return JSON.stringify(value);
  }

  /**
   * 값 역직렬화
   */
  private deserialize<T>(value: string): T {
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  /**
   * 응답 시간 업데이트
   */
  private updateResponseTime(duration: number): void {
    const totalRequests = this.metrics.hits + this.metrics.misses + this.metrics.sets;
    if (totalRequests > 0) {
      this.metrics.avgResponseTime = (this.metrics.avgResponseTime * (totalRequests - 1) + duration) / totalRequests;
    }
  }
}
