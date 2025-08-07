/**
 * Redis Cache Service - LLM 응답 캐싱 및 세션 관리
 * 계약 준수: TASK-3 Redis 키 구조 100% 준수
 */

import Redis from 'ioredis';
import crypto from 'crypto';
import { finalConfig } from '../config';
import logger from '../utils/logger';
import { ChatResponse } from '../types/contracts';

export class CacheService {
  private redis: Redis | null = null;
  private readonly keyPrefix = 'automation:cache:llm';

  /**
   * Redis 연결 초기화
   */
  async connect(): Promise<void> {
    try {
      this.redis = new Redis({
        host: finalConfig.databases.redis.host,
        port: finalConfig.databases.redis.port,
        password: finalConfig.databases.redis.password,
        db: finalConfig.databases.redis.db,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      await this.redis.connect();
      logger.info('Redis cache connected successfully');
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  /**
   * Redis 연결 종료
   */
  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.disconnect();
      logger.info('Redis cache disconnected');
    }
  }

  /**
   * 헬스체크
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.redis) return false;
      await this.redis.ping();
      return true;
    } catch (error) {
      logger.error('Redis health check failed:', error);
      return false;
    }
  }

  /**
   * LLM 응답 캐시 조회
   * 키 패턴: automation:cache:llm:response:{prompt_hash}
   */
  async getCachedResponse(promptHash: string): Promise<ChatResponse | null> {
    try {
      if (!this.redis) {
        throw new Error('Redis not connected');
      }

      const key = `${this.keyPrefix}:response:${promptHash}`;
      const cached = await this.redis.get(key);
      
      if (!cached) {
        return null;
      }

      const response = JSON.parse(cached) as ChatResponse;
      logger.debug('Cache hit for prompt hash:', { promptHash });
      
      return response;
    } catch (error) {
      logger.error('Failed to get cached response:', error);
      return null;
    }
  }

  /**
   * LLM 응답 캐시 저장
   */
  async setCachedResponse(promptHash: string, response: ChatResponse, ttl: number): Promise<void> {
    try {
      if (!this.redis) {
        throw new Error('Redis not connected');
      }

      const key = `${this.keyPrefix}:response:${promptHash}`;
      const value = JSON.stringify(response);
      
      await this.redis.setex(key, ttl, value);
      logger.debug('Response cached:', { promptHash, ttl });
    } catch (error) {
      logger.error('Failed to cache response:', error);
    }
  }

  /**
   * 기본 Redis get 메서드
   */
  async get(key: string): Promise<string | null> {
    try {
      if (!this.redis) {
        throw new Error('Redis not connected');
      }
      return await this.redis.get(key);
    } catch (error) {
      logger.error('Failed to get from cache:', error);
      return null;
    }
  }

  /**
   * 기본 Redis setex 메서드
   */
  async setex(key: string, ttl: number, value: string): Promise<void> {
    try {
      if (!this.redis) {
        throw new Error('Redis not connected');
      }
      await this.redis.setex(key, ttl, value);
    } catch (error) {
      logger.error('Failed to set cache:', error);
    }
  }

  /**
   * 기본 Redis del 메서드
   */
  async del(key: string): Promise<void> {
    try {
      if (!this.redis) {
        throw new Error('Redis not connected');
      }
      await this.redis.del(key);
    } catch (error) {
      logger.error('Failed to delete from cache:', error);
    }
  }

  /**
   * 프롬프트 해시 생성
   */
  async generatePromptHash(normalizedPrompt: string): Promise<string> {
    return crypto.createHash('sha256').update(normalizedPrompt).digest('hex');
  }

  /**
   * 사용량 추적 저장
   * 키 패턴: automation:usage:llm:{provider}:{date}
   */
  async trackUsage(provider: string, date: string, usage: {
    requests: number;
    tokens: number;
    cost: number;
  }): Promise<void> {
    try {
      if (!this.redis) {
        throw new Error('Redis not connected');
      }

      const key = `automation:usage:llm:${provider}:${date}`;
      const current = await this.redis.get(key);
      
      let totalUsage = usage;
      if (current) {
        const existing = JSON.parse(current);
        totalUsage = {
          requests: existing.requests + usage.requests,
          tokens: existing.tokens + usage.tokens,
          cost: existing.cost + usage.cost,
        };
      }

      await this.redis.setex(key, 30 * 24 * 60 * 60, JSON.stringify(totalUsage)); // 30일 TTL
    } catch (error) {
      logger.error('Failed to track usage:', error);
    }
  }

  /**
   * 프로바이더 헬스 상태 저장
   * 키 패턴: automation:health:llm:{provider}
   */
  async setProviderHealth(provider: string, status: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    responseTime: number;
    lastCheck: string;
    errorRate?: number;
  }): Promise<void> {
    try {
      if (!this.redis) {
        throw new Error('Redis not connected');
      }

      const key = `automation:health:llm:${provider}`;
      await this.redis.setex(key, 5 * 60, JSON.stringify(status)); // 5분 TTL
    } catch (error) {
      logger.error('Failed to set provider health:', error);
    }
  }

  /**
   * 프로바이더 헬스 상태 조회
   */
  async getProviderHealth(provider: string): Promise<any> {
    try {
      if (!this.redis) {
        throw new Error('Redis not connected');
      }

      const key = `automation:health:llm:${provider}`;
      const health = await this.redis.get(key);
      
      return health ? JSON.parse(health) : null;
    } catch (error) {
      logger.error('Failed to get provider health:', error);
      return null;
    }
  }

  /**
   * 세션별 토큰 사용량 추적
   * 키 패턴: automation:session:llm:{session_id}
   */
  async trackSessionUsage(sessionId: string, tokens: number): Promise<void> {
    try {
      if (!this.redis) {
        throw new Error('Redis not connected');
      }

      const key = `automation:session:llm:${sessionId}`;
      await this.redis.incrby(key, tokens);
      await this.redis.expire(key, 24 * 60 * 60); // 24시간 TTL
    } catch (error) {
      logger.error('Failed to track session usage:', error);
    }
  }

  /**
   * Rate Limiting을 위한 요청 카운트
   * 키 패턴: automation:queue:llm:{provider}:{model}
   */
  async incrementRequestCount(provider: string, model: string): Promise<number> {
    try {
      if (!this.redis) {
        throw new Error('Redis not connected');
      }

      const key = `automation:queue:llm:${provider}:${model}`;
      const count = await this.redis.incr(key);
      await this.redis.expire(key, 60); // 1분 TTL
      
      return count;
    } catch (error) {
      logger.error('Failed to increment request count:', error);
      return 0;
    }
  }

  /**
   * 캐시 통계 조회
   */
  async getCacheStats(): Promise<{
    hitRate: number;
    totalKeys: number;
    memoryUsage: number;
  }> {
    try {
      if (!this.redis) {
        throw new Error('Redis not connected');
      }

      const info = await this.redis.info('stats');
      const memInfo = await this.redis.info('memory');
      
      // 간단한 통계 추출 (실제로는 더 정교한 파싱 필요)
      const keys = await this.redis.dbsize();
      
      return {
        hitRate: 0, // TODO: 실제 히트율 계산
        totalKeys: keys,
        memoryUsage: 0, // TODO: 메모리 사용량 계산
      };
    } catch (error) {
      logger.error('Failed to get cache stats:', error);
      return {
        hitRate: 0,
        totalKeys: 0,
        memoryUsage: 0,
      };
    }
  }

  /**
   * 캐시 키 패턴으로 삭제
   */
  async invalidatePattern(pattern: string): Promise<number> {
    try {
      if (!this.redis) {
        throw new Error('Redis not connected');
      }

      const keys = await this.redis.keys(`${this.keyPrefix}:${pattern}`);
      if (keys.length === 0) {
        return 0;
      }

      const deleted = await this.redis.del(...keys);
      logger.info('Cache invalidated:', { pattern, deleted });
      
      return deleted;
    } catch (error) {
      logger.error('Failed to invalidate cache:', error);
      return 0;
    }
  }
}
