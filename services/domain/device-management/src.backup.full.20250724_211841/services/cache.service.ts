/**
 * Cache Service - Redis 기반 캐싱 서비스
 * TASK-4-PRISMA에서 검증된 완전한 구현 재사용
 * 
 * @file src/services/cache.service.ts
 * @description Device Management Service용 캐시 서비스
 * @author Backend Team - Domains
 */

import Redis from 'ioredis';
import { createLogger } from '../utils/logger';

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
  private logger = createLogger();
  private metrics: CacheMetrics;
  private startTime: number;

  // Device Management Service용 캐시 전략
  private readonly CACHE_STRATEGIES: Record<string, CacheStrategy> = {
    'device:': { ttl: 300, tags: ['device'], refreshThreshold: 240 },
    'device:list:': { ttl: 30, tags: ['device', 'list'], refreshThreshold: 20 },
    'device:status:': { ttl: 60, tags: ['device', 'status'], refreshThreshold: 45 },
    'device:metrics:': { ttl: 60, tags: ['device', 'metrics'], refreshThreshold: 45 },
    'device:search:': { ttl: 60, tags: ['device', 'search'], refreshThreshold: 45 },
    'device:stats': { ttl: 60, tags: ['device', 'stats'], refreshThreshold: 45 },
    'device:group:': { ttl: 120, tags: ['device', 'group'], refreshThreshold: 90 },
    'device:tags:': { ttl: 120, tags: ['device', 'tags'], refreshThreshold: 90 },
    'device:history:': { ttl: 60, tags: ['device', 'history'], refreshThreshold: 45 }
  };

  constructor(redis: Redis) {
    this.redis = redis;
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
      this.logger.error('Redis error:', { error: error.message });
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
        this.logger.debug('Cache miss:', { key });
        return null;
      }

      this.metrics.hits++;
      
      const result = this.deserialize<T>(value);
      this.logger.debug('Cache hit:', { key });
      
      return result;
    } catch (error) {
      this.metrics.errors++;
      this.logger.error('Cache get failed:', { key, error });
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

      this.logger.debug('Cache set:', { key, ttl });
      
      return true;
    } catch (error) {
      this.metrics.errors++;
      this.logger.error('Cache set failed:', { key, error });
      return false;
    }
  }

  /**
   * setex - setex with TTL
   */
  async setex(key: string, seconds: number, value: any): Promise<void> {
    await this.set(key, value, seconds);
  }

  /**
   * 키 삭제
   */
  async del(...keys: string[]): Promise<number> {
    try {
      const result = await this.redis.del(...keys);
      this.metrics.deletes += result;
      this.logger.debug('Cache delete:', { keys, deleted: result });
      return result;
    } catch (error) {
      this.metrics.errors++;
      this.logger.error('Cache delete failed:', { keys, error });
      return 0;
    }
  }

  /**
   * 키 패턴 조회
   */
  async keys(pattern: string): Promise<string[]> {
    try {
      return await this.redis.keys(pattern);
    } catch (error) {
      this.logger.error('Keys pattern failed:', { pattern, error });
      return [];
    }
  }

  /**
   * 패턴 기반 키 삭제
   */
  async delPattern(pattern: string): Promise<number> {
    try {
      const keys = await this.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }

      const result = await this.del(...keys);
      this.logger.debug('Pattern delete:', { pattern, deleted: result });
      return result;
    } catch (error) {
      this.metrics.errors++;
      this.logger.error('Pattern delete failed:', { pattern, error });
      return 0;
    }
  }

  /**
   * 모든 캐시 삭제
   */
  async flushall(): Promise<void> {
    try {
      await this.redis.flushall();
      this.logger.info('All cache flushed');
    } catch (error) {
      this.metrics.errors++;
      this.logger.error('Flush all failed:', { error });
      throw error;
    }
  }

  /**
   * Redis 연결 상태 확인
   */
  async ping(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      this.logger.error('Redis ping failed:', { error });
      return false;
    }
  }

  /**
   * 해시 필드 설정
   */
  async hset(key: string, data: Record<string, string>): Promise<void> {
    try {
      await this.redis.hset(key, data);
      
      const strategy = this.getStrategy(key);
      if (strategy.ttl) {
        await this.redis.expire(key, strategy.ttl);
      }

      this.logger.debug('Hash set:', { key, fields: Object.keys(data).length });
    } catch (error) {
      this.metrics.errors++;
      this.logger.error('Hash set failed:', { key, error });
      throw error;
    }
  }

  /**
   * 해시 필드 조회
   */
  async hget(key: string, field: string): Promise<string | null> {
    try {
      const value = await this.redis.hget(key, field);
      
      if (value === null) {
        this.metrics.misses++;
        return null;
      }

      this.metrics.hits++;
      return value;
    } catch (error) {
      this.metrics.errors++;
      this.logger.error('Hash get failed:', { key, field, error });
      return null;
    }
  }

  /**
   * 해시 전체 조회
   */
  async hgetall(key: string): Promise<Record<string, string>> {
    try {
      const result = await this.redis.hgetall(key);
      
      if (Object.keys(result).length === 0) {
        this.metrics.misses++;
      } else {
        this.metrics.hits++;
      }

      return result;
    } catch (error) {
      this.metrics.errors++;
      this.logger.error('Hash getall failed:', { key, error });
      return {};
    }
  }

  /**
   * 해시 필드 삭제
   */
  async hdel(key: string, field: string): Promise<void> {
    try {
      await this.redis.hdel(key, field);
      this.metrics.deletes++;
      this.logger.debug('Hash field delete:', { key, field });
    } catch (error) {
      this.metrics.errors++;
      this.logger.error('Hash delete failed:', { key, field, error });
    }
  }

  /**
   * TTL 설정
   */
  async expire(key: string, seconds: number): Promise<void> {
    try {
      await this.redis.expire(key, seconds);
    } catch (error) {
      this.logger.error('Expire failed:', { key, seconds, error });
    }
  }

  /**
   * TTL 조회
   */
  async ttl(key: string): Promise<number> {
    try {
      return await this.redis.ttl(key);
    } catch (error) {
      this.logger.error('TTL check failed:', { key, error });
      return -1;
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
      this.logger.error('Exists check failed:', { key, error });
      return false;
    }
  }

  /**
   * 캐시 통계 조회
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
      this.logger.error('Failed to get cache stats:', { error });
      throw error;
    }
  }

  /**
   * 연결 종료
   */
  async disconnect(): Promise<void> {
    try {
      await this.redis.disconnect();
      this.logger.info('Cache service disconnected');
    } catch (error) {
      this.logger.warn('Cache disconnect failed:', { error });
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
