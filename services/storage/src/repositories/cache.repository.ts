/**
 * Cache Repository (Redis)
 * Redis 기반 캐시 관리 및 세션 저장소
 * infrastructure/database/schemas/redis-keys.md 기준 준수
 */

import Redis from 'ioredis';
import { BaseRepository, QueryOptions, PaginatedResult, FilterOptions } from './base.repository';
import { Logger } from '../utils/logger';

export interface CacheEntry {
  key: string;
  value: any;
  ttl?: number;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface SessionData {
  sessionId: string;
  userId: string;
  data: Record<string, any>;
  expiresAt: Date;
  lastAccess: Date;
}

export interface CacheStats {
  totalKeys: number;
  memoryUsage: string;
  hitRate: number;
  missRate: number;
  keysByPattern: Record<string, number>;
}

export class CacheRepository extends BaseRepository<CacheEntry, string> {
  protected entityName = 'Cache';
  protected cachePrefix = 'cache';

  private redis: Redis;
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    dels: 0
  };

  // Redis 키 패턴 (redis-keys.md 기준)
  private readonly KEY_PATTERNS = {
    // 장비 관련
    DEVICE_STATUS: 'device:status:{deviceId}',
    DEVICE_METRICS: 'device:metrics:{deviceId}',
    DEVICE_LIST: 'device:list:{hash}',
    
    // API 응답 캐시
    API_RESPONSE: 'api:{endpoint}:{hash}',
    API_DEVICE: 'api:device:{deviceId}',
    API_DEVICES_LIST: 'api:devices:list:{hash}',
    
    // 세션 관리
    SESSION: 'session:{sessionId}',
    USER_SESSIONS: 'user:sessions:{userId}',
    
    // LLM 캐시
    LLM_RESPONSE: 'llm:response:{hash}',
    LLM_PROMPT: 'llm:prompt:{templateId}',
    
    // 워크플로우 캐시
    WORKFLOW_STATUS: 'workflow:status:{executionId}',
    WORKFLOW_RESULT: 'workflow:result:{executionId}',
    
    // MCP 캐시
    MCP_TOOLS: 'mcp:tools:{serverId}',
    MCP_STATUS: 'mcp:status:{serverId}',
    
    // 임시 데이터
    TEMP_DATA: 'temp:{key}',
    LOCK: 'lock:{resource}'
  };

  // TTL 설정 (초)
  private readonly DEFAULT_TTLS = {
    DEVICE_STATUS: 300,    // 5분
    DEVICE_METRICS: 60,    // 1분
    API_RESPONSE: 30,      // 30초
    SESSION: 3600,         // 1시간
    LLM_RESPONSE: 1800,    // 30분
    WORKFLOW_STATUS: 600,  // 10분
    MCP_TOOLS: 3600,       // 1시간
    TEMP_DATA: 300,        // 5분
    LOCK: 60               // 1분
  };

  constructor(redis: Redis, logger: Logger) {
    super(redis, null, logger); // Redis는 자체적으로 캐시 역할
    this.redis = redis;
  }

  /**
   * 키로 캐시 조회
   */
  async findById(key: string): Promise<CacheEntry | null> {
    try {
      const value = await this.redis.get(key);
      
      if (value === null) {
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      
      const ttl = await this.redis.ttl(key);
      
      return {
        key,
        value: this.deserialize(value),
        ttl: ttl > 0 ? ttl : undefined
      };
    } catch (error) {
      this.handleError('findById', error, { key });
    }
  }

  /**
   * 패턴으로 키 목록 조회
   */
  async findAll(options: QueryOptions = {}): Promise<PaginatedResult<CacheEntry>> {
    try {
      const { limit = 100, offset = 0, filter = {} } = options;
      const pattern = (filter as any).pattern || '*';
      
      const keys = await this.redis.keys(pattern);
      const total = keys.length;
      
      const paginatedKeys = keys.slice(offset, offset + limit);
      const pipeline = this.redis.pipeline();
      
      // 값과 TTL을 배치로 조회
      paginatedKeys.forEach(key => {
        pipeline.get(key);
        pipeline.ttl(key);
      });
      
      const results = await pipeline.exec();
      const items: CacheEntry[] = [];
      
      for (let i = 0; i < paginatedKeys.length; i++) {
        const key = paginatedKeys[i];
        const valueResult = results?.[i * 2];
        const ttlResult = results?.[i * 2 + 1];
        
        if (valueResult?.[1] !== null) {
          items.push({
            key,
            value: this.deserialize(valueResult[1] as string),
            ttl: (ttlResult?.[1] as number) > 0 ? ttlResult[1] as number : undefined
          });
        }
      }

      return this.createPaginatedResult(items, total, limit, offset);
    } catch (error) {
      this.handleError('findAll', error, { options });
    }
  }

  /**
   * 캐시 엔트리 생성/업데이트
   */
  async create(entry: Partial<CacheEntry>): Promise<CacheEntry> {
    if (!entry.key || entry.value === undefined) {
      throw new Error('Key and value are required');
    }

    return this.set(entry.key, entry.value, entry.ttl);
  }

  /**
   * 캐시 엔트리 업데이트
   */
  async update(key: string, entry: Partial<CacheEntry>): Promise<CacheEntry> {
    if (entry.value === undefined) {
      throw new Error('Value is required for update');
    }

    return this.set(key, entry.value, entry.ttl);
  }

  /**
   * 캐시 엔트리 삭제
   */
  async delete(key: string): Promise<boolean> {
    try {
      const result = await this.redis.del(key);
      this.stats.dels++;
      
      this.logger.debug('Cache key deleted', { key });
      return result > 0;
    } catch (error) {
      this.handleError('delete', error, { key });
    }
  }

  /**
   * 배치 생성 (지원하지 않음 - 개별 set 사용)
   */
  async createMany(entries: Partial<CacheEntry>[]): Promise<CacheEntry[]> {
    const results: CacheEntry[] = [];
    
    for (const entry of entries) {
      const result = await this.create(entry);
      results.push(result);
    }
    
    return results;
  }

  /**
   * 배치 업데이트 (지원하지 않음)
   */
  async updateMany(filter: FilterOptions, entity: Partial<CacheEntry>): Promise<number> {
    throw new Error('Batch update not supported for cache entries');
  }

  /**
   * 패턴으로 배치 삭제
   */
  async deleteMany(filter: FilterOptions): Promise<number> {
    try {
      const pattern = (filter as any).pattern;
      if (!pattern) {
        throw new Error('Pattern is required for batch delete');
      }

      const keys = await this.redis.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }

      const result = await this.redis.del(...keys);
      this.stats.dels += result;
      
      this.logger.info('Batch cache delete completed', { 
        pattern, 
        deletedCount: result 
      });
      
      return result;
    } catch (error) {
      this.handleError('deleteMany', error, { filter });
    }
  }

  /**
   * 트랜잭션 실행 (Redis 파이프라인 사용)
   */
  async executeInTransaction<R>(callback: (pipeline: any) => Promise<R>): Promise<R> {
    const pipeline = this.redis.pipeline();
    const result = await callback(pipeline);
    await pipeline.exec();
    return result;
  }

  /**
   * 값 설정 (TTL 포함)
   */
  async set(key: string, value: any, ttl?: number): Promise<CacheEntry> {
    try {
      const serializedValue = this.serialize(value);
      
      if (ttl) {
        await this.redis.setex(key, ttl, serializedValue);
      } else {
        await this.redis.set(key, serializedValue);
      }
      
      this.stats.sets++;
      
      this.logger.debug('Cache set', { key, ttl });
      
      return {
        key,
        value,
        ttl
      };
    } catch (error) {
      this.handleError('set', error, { key, ttl });
    }
  }

  /**
   * 값 조회
   */
  async get(key: string): Promise<any> {
    try {
      const value = await this.redis.get(key);
      
      if (value === null) {
        this.stats.misses++;
        return null;
      }
      
      this.stats.hits++;
      return this.deserialize(value);
    } catch (error) {
      this.handleError('get', error, { key });
    }
  }

  /**
   * 해시 필드 설정
   */
  async hset(key: string, field: string, value: any, ttl?: number): Promise<void> {
    try {
      const serializedValue = this.serialize(value);
      await this.redis.hset(key, field, serializedValue);
      
      if (ttl) {
        await this.redis.expire(key, ttl);
      }
      
      this.logger.debug('Hash field set', { key, field, ttl });
    } catch (error) {
      this.handleError('hset', error, { key, field, ttl });
    }
  }

  /**
   * 해시 필드 조회
   */
  async hget(key: string, field: string): Promise<any> {
    try {
      const value = await this.redis.hget(key, field);
      
      if (value === null) {
        this.stats.misses++;
        return null;
      }
      
      this.stats.hits++;
      return this.deserialize(value);
    } catch (error) {
      this.handleError('hget', error, { key, field });
    }
  }

  /**
   * 해시 전체 조회
   */
  async hgetall(key: string): Promise<Record<string, any>> {
    try {
      const values = await this.redis.hgetall(key);
      
      if (Object.keys(values).length === 0) {
        this.stats.misses++;
        return {};
      }
      
      this.stats.hits++;
      
      const result: Record<string, any> = {};
      Object.entries(values).forEach(([field, value]) => {
        result[field] = this.deserialize(value);
      });
      
      return result;
    } catch (error) {
      this.handleError('hgetall', error, { key });
    }
  }

  /**
   * 키 존재 확인
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result > 0;
    } catch (error) {
      this.handleError('exists', error, { key });
    }
  }

  /**
   * TTL 조회
   */
  async ttl(key: string): Promise<number> {
    try {
      return await this.redis.ttl(key);
    } catch (error) {
      this.handleError('ttl', error, { key });
    }
  }

  /**
   * TTL 설정
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      const result = await this.redis.expire(key, seconds);
      return result === 1;
    } catch (error) {
      this.handleError('expire', error, { key, seconds });
    }
  }

  /**
   * 증가 연산
   */
  async incr(key: string, ttl?: number): Promise<number> {
    try {
      const value = await this.redis.incr(key);
      
      if (ttl && value === 1) { // 첫 생성시에만 TTL 설정
        await this.redis.expire(key, ttl);
      }
      
      return value;
    } catch (error) {
      this.handleError('incr', error, { key, ttl });
    }
  }

  /**
   * 분산 락 획득
   */
  async acquireLock(resource: string, ttl: number = 60, retryDelay: number = 100, maxRetries: number = 10): Promise<string | null> {
    const lockKey = this.KEY_PATTERNS.LOCK.replace('{resource}', resource);
    const lockValue = `${Date.now()}_${Math.random()}`;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await this.redis.set(lockKey, lockValue, 'EX', ttl, 'NX');
        
        if (result === 'OK') {
          this.logger.debug('Lock acquired', { resource, lockValue, ttl });
          return lockValue;
        }
        
        // 재시도 대기
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      } catch (error) {
        this.handleError('acquireLock', error, { resource, attempt });
      }
    }
    
    this.logger.warn('Failed to acquire lock', { resource, maxRetries });
    return null;
  }

  /**
   * 분산 락 해제
   */
  async releaseLock(resource: string, lockValue: string): Promise<boolean> {
    const lockKey = this.KEY_PATTERNS.LOCK.replace('{resource}', resource);
    
    try {
      // Lua 스크립트로 원자적 락 해제
      const script = `
        if redis.call("GET", KEYS[1]) == ARGV[1] then
          return redis.call("DEL", KEYS[1])
        else
          return 0
        end
      `;
      
      const result = await this.redis.eval(script, 1, lockKey, lockValue) as number;
      
      this.logger.debug('Lock release attempted', { 
        resource, 
        lockValue, 
        released: result === 1 
      });
      
      return result === 1;
    } catch (error) {
      this.handleError('releaseLock', error, { resource, lockValue });
    }
  }

  /**
   * 세션 데이터 저장
   */
  async setSession(sessionId: string, data: SessionData): Promise<void> {
    const key = this.KEY_PATTERNS.SESSION.replace('{sessionId}', sessionId);
    const ttl = Math.floor((data.expiresAt.getTime() - Date.now()) / 1000);
    
    if (ttl <= 0) {
      throw new Error('Session expiration time must be in the future');
    }
    
    await this.set(key, data, ttl);
    
    // 사용자별 세션 목록에 추가
    const userSessionsKey = this.KEY_PATTERNS.USER_SESSIONS.replace('{userId}', data.userId);
    await this.redis.sadd(userSessionsKey, sessionId);
    await this.redis.expire(userSessionsKey, ttl);
  }

  /**
   * 세션 데이터 조회
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    const key = this.KEY_PATTERNS.SESSION.replace('{sessionId}', sessionId);
    const data = await this.get(key);
    
    if (data) {
      // 마지막 접근 시간 업데이트
      data.lastAccess = new Date();
      await this.set(key, data, await this.ttl(key));
    }
    
    return data;
  }

  /**
   * 세션 삭제
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    const key = this.KEY_PATTERNS.SESSION.replace('{sessionId}', sessionId);
    
    // 세션 데이터 조회 (사용자 ID 확인용)
    const sessionData = await this.get(key);
    
    // 세션 삭제
    const deleted = await this.delete(key);
    
    // 사용자별 세션 목록에서 제거
    if (sessionData?.userId) {
      const userSessionsKey = this.KEY_PATTERNS.USER_SESSIONS.replace('{userId}', sessionData.userId);
      await this.redis.srem(userSessionsKey, sessionId);
    }
    
    return deleted;
  }

  /**
   * 사용자의 모든 세션 조회
   */
  async getUserSessions(userId: string): Promise<string[]> {
    const key = this.KEY_PATTERNS.USER_SESSIONS.replace('{userId}', userId);
    return await this.redis.smembers(key);
  }

  /**
   * 캐시 통계 조회
   */
  async getStats(): Promise<CacheStats> {
    try {
      const info = await this.redis.info('memory');
      const memoryUsage = this.parseMemoryInfo(info);
      
      const keyPatterns: Record<string, number> = {};
      
      // 패턴별 키 개수 집계
      for (const [patternName, pattern] of Object.entries(this.KEY_PATTERNS)) {
        const searchPattern = pattern.replace(/\{[^}]+\}/g, '*');
        const keys = await this.redis.keys(searchPattern);
        keyPatterns[patternName] = keys.length;
      }
      
      const totalKeys = Object.values(keyPatterns).reduce((sum, count) => sum + count, 0);
      const totalRequests = this.stats.hits + this.stats.misses;
      
      return {
        totalKeys,
        memoryUsage,
        hitRate: totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0,
        missRate: totalRequests > 0 ? (this.stats.misses / totalRequests) * 100 : 0,
        keysByPattern: keyPatterns
      };
    } catch (error) {
      this.handleError('getStats', error);
    }
  }

  /**
   * 캐시 플러시 (특정 패턴)
   */
  async flush(pattern?: string): Promise<number> {
    try {
      if (pattern) {
        return await this.deleteMany({ pattern });
      } else {
        // 전체 플러시
        await this.redis.flushdb();
        this.logger.warn('All cache data flushed');
        return 0; // 정확한 개수는 알 수 없음
      }
    } catch (error) {
      this.handleError('flush', error, { pattern });
    }
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
  private deserialize(value: string): any {
    try {
      return JSON.parse(value);
    } catch {
      return value; // JSON이 아닌 경우 문자열 그대로 반환
    }
  }

  /**
   * 메모리 정보 파싱
   */
  private parseMemoryInfo(info: string): string {
    const lines = info.split('\r\n');
    const usedMemoryLine = lines.find(line => line.startsWith('used_memory_human:'));
    return usedMemoryLine ? usedMemoryLine.split(':')[1] : 'Unknown';
  }

  /**
   * Redis 연결 상태 확인
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      this.logger.error('Redis health check failed', { error: error.message });
      return false;
    }
  }

  /**
   * 캐시 키 생성 헬퍼 메서드들
   */
  createDeviceStatusKey(deviceId: string): string {
    return this.KEY_PATTERNS.DEVICE_STATUS.replace('{deviceId}', deviceId);
  }

  createDeviceMetricsKey(deviceId: string): string {
    return this.KEY_PATTERNS.DEVICE_METRICS.replace('{deviceId}', deviceId);
  }

  createApiResponseKey(endpoint: string, hash: string): string {
    return this.KEY_PATTERNS.API_RESPONSE.replace('{endpoint}', endpoint).replace('{hash}', hash);
  }

  createLLMResponseKey(hash: string): string {
    return this.KEY_PATTERNS.LLM_RESPONSE.replace('{hash}', hash);
  }

  createWorkflowStatusKey(executionId: string): string {
    return this.KEY_PATTERNS.WORKFLOW_STATUS.replace('{executionId}', executionId);
  }

  createMCPToolsKey(serverId: string): string {
    return this.KEY_PATTERNS.MCP_TOOLS.replace('{serverId}', serverId);
  }
}
