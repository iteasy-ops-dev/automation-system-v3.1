/**
 * Redis 설정 - ioredis 기반
 * TASK-4-PRISMA: CacheService 기반 설정 재사용
 * TypeScript 5.x 완전 호환
 */

import Redis, { RedisOptions } from 'ioredis';
import { Logger } from '../utils/logger';

export interface RedisConfig extends RedisOptions {
  host: string;
  port: number;
  password?: string;
  db?: number;
  retryDelayOnFailover?: number;
  maxRetriesPerRequest?: number;
  connectTimeout?: number;
  commandTimeout?: number;
}

export class RedisConnectionManager {
  private static instance: Redis;
  private static logger: Logger = new Logger('RedisConnectionManager');

  /**
   * REDIS_URL 파싱 헬퍼
   */
  private static parseRedisUrl(url: string): RedisConfig {
    try {
      const parsed = new URL(url);
      return {
        host: parsed.hostname,
        port: parsed.port ? parseInt(parsed.port) : 6379,
        password: parsed.password || undefined,
        db: parsed.pathname.length > 1 ? parseInt(parsed.pathname.slice(1)) : 0,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        connectTimeout: 10000,
        commandTimeout: 5000,
      };
    } catch (error) {
      RedisConnectionManager.logger.error('Failed to parse REDIS_URL', error);
      // 폴백 설정
      return {
        host: 'localhost',
        port: 6379,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        connectTimeout: 10000,
        commandTimeout: 5000,
      };
    }
  }

  /**
   * Redis 연결 싱글톤 인스턴스 반환
   */
  public static getInstance(): Redis {
    if (!RedisConnectionManager.instance) {
      let config: RedisConfig;
      
      // REDIS_URL 우선 사용, 없으면 개별 환경 변수 사용
      if (process.env.REDIS_URL) {
        config = RedisConnectionManager.parseRedisUrl(process.env.REDIS_URL);
      } else {
        config = {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD,
          db: parseInt(process.env.REDIS_DB || '0'),
          retryDelayOnFailover: 100,
          maxRetriesPerRequest: 3,
          connectTimeout: 10000,
          commandTimeout: 5000,
        };
      }

      RedisConnectionManager.instance = new Redis(config);

      // 이벤트 핸들러 설정
      RedisConnectionManager.instance.on('connect', () => {
        RedisConnectionManager.logger.info('Redis connected successfully');
      });

      RedisConnectionManager.instance.on('error', (error: Error) => {
        RedisConnectionManager.logger.error('Redis connection error', error);
      });

      RedisConnectionManager.instance.on('close', () => {
        RedisConnectionManager.logger.warn('Redis connection closed');
      });

      RedisConnectionManager.instance.on('reconnecting', () => {
        RedisConnectionManager.logger.info('Redis reconnecting...');
      });
    }

    return RedisConnectionManager.instance;
  }

  /**
   * Redis 연결 상태 확인
   */
  public static async testConnection(): Promise<boolean> {
    try {
      const redis = RedisConnectionManager.getInstance();
      const result = await redis.ping();
      RedisConnectionManager.logger.info('Redis ping successful', { result });
      return result === 'PONG';
    } catch (error) {
      RedisConnectionManager.logger.error('Redis ping failed', error);
      return false;
    }
  }

  /**
   * Redis 연결 해제
   */
  public static async disconnect(): Promise<void> {
    try {
      if (RedisConnectionManager.instance) {
        await RedisConnectionManager.instance.quit();
        RedisConnectionManager.logger.info('Redis disconnected successfully');
      }
    } catch (error) {
      RedisConnectionManager.logger.error('Error disconnecting Redis', error);
    }
  }
}

// 기본 내보내기
export const redis = RedisConnectionManager.getInstance();
export default RedisConnectionManager;
