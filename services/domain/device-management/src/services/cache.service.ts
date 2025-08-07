/**
 * Cache Service - Device Management Service
 * Redis 직접 연동 (v3.1 아키텍처에서 허용됨)
 * 실시간 상태 및 캐싱 관리
 */

import Redis from 'ioredis';
import { Logger } from '../utils/logger';
import { DeviceStatus, DeviceMetrics } from '../types';

export class CacheService {
  private redis: Redis;
  private logger: Logger;

  constructor(redisUrl: string) {
    this.logger = new Logger('CacheService');
    
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    this.redis.on('connect', () => {
      this.logger.logSuccess('Redis connected successfully');
    });

    this.redis.on('error', (error) => {
      this.logger.logError('Redis connection error', error);
    });

    this.redis.on('reconnecting', () => {
      this.logger.warn('Redis reconnecting...');
    });
  }

  /**
   * Redis 연결 초기화
   */
  async connect(): Promise<void> {
    try {
      await this.redis.connect();
      this.logger.logSuccess('Cache service initialized');
    } catch (error) {
      this.logger.logError('Failed to connect to Redis', error);
      throw error;
    }
  }

  /**
   * 연결 해제
   */
  async disconnect(): Promise<void> {
    try {
      await this.redis.disconnect();
      this.logger.info('Cache service disconnected');
    } catch (error) {
      this.logger.logError('Error disconnecting from Redis', error);
    }
  }

  // ============ 기본 캐시 작업 ============

  /**
   * 값 저장
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    try {
      const serializedValue = JSON.stringify(value);
      
      if (ttlSeconds) {
        await this.redis.setex(key, ttlSeconds, serializedValue);
      } else {
        await this.redis.set(key, serializedValue);
      }

      this.logger.debug('Cache set', { key, ttl: ttlSeconds });
    } catch (error) {
      this.logger.error('Failed to set cache', error, { key });
      throw error;
    }
  }

  /**
   * 값 조회
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      
      if (value === null) {
        return null;
      }

      const parsed = JSON.parse(value);
      this.logger.debug('Cache hit', { key });
      return parsed;
    } catch (error) {
      this.logger.error('Failed to get cache', error, { key });
      return null;
    }
  }

  /**
   * 값 삭제
   */
  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
      this.logger.debug('Cache deleted', { key });
    } catch (error) {
      this.logger.error('Failed to delete cache', error, { key });
    }
  }

  /**
   * 패턴으로 키 삭제
   */
  async delPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.info('Cache pattern deleted', { pattern, count: keys.length });
      }
    } catch (error) {
      this.logger.error('Failed to delete cache pattern', error, { pattern });
    }
  }

  // ============ Device 실시간 상태 관리 ============

  /**
   * 장비 실시간 상태 저장
   */
  async setDeviceStatus(deviceId: string, status: DeviceStatus, metrics?: DeviceMetrics): Promise<void> {
    const key = `device:status:${deviceId}`;
    const statusData = {
      status,
      lastHeartbeat: new Date().toISOString(),
      metrics,
      updatedAt: new Date().toISOString()
    };

    try {
      await this.set(key, statusData, 300); // 5분 TTL
      this.logger.debug('Device status cached', { deviceId, status });
    } catch (error) {
      this.logger.error('Failed to cache device status', error, { deviceId, status });
    }
  }

  /**
   * 장비 실시간 상태 조회
   */
  async getDeviceStatus(deviceId: string): Promise<{
    status: DeviceStatus;
    lastHeartbeat: string;
    metrics?: DeviceMetrics;
    updatedAt: string;
  } | null> {
    const key = `device:status:${deviceId}`;
    return this.get(key);
  }

  /**
   * 모든 활성 장비 상태 조회
   */
  async getAllDeviceStatuses(): Promise<Record<string, any>> {
    try {
      const keys = await this.redis.keys('device:status:*');
      const result: Record<string, any> = {};

      for (const key of keys) {
        const deviceId = key.replace('device:status:', '');
        const status = await this.get(key);
        if (status) {
          result[deviceId] = status;
        }
      }

      this.logger.debug('All device statuses retrieved', { count: Object.keys(result).length });
      return result;
    } catch (error) {
      this.logger.error('Failed to get all device statuses', error);
      return {};
    }
  }

  // ============ 장비 목록 캐싱 ============

  /**
   * 장비 목록 캐시 키 생성
   */
  private getDeviceListCacheKey(filters: any): string {
    const filterHash = JSON.stringify(filters);
    return `devices:list:${Buffer.from(filterHash).toString('base64')}`;
  }

  /**
   * 장비 목록 캐시 저장
   */
  async cacheDeviceList(filters: any, data: any, ttlSeconds: number = 300): Promise<void> {
    const key = this.getDeviceListCacheKey(filters);
    await this.set(key, data, ttlSeconds);
  }

  /**
   * 장비 목록 캐시 조회
   */
  async getCachedDeviceList(filters: any): Promise<any | null> {
    const key = this.getDeviceListCacheKey(filters);
    return this.get(key);
  }

  /**
   * 장비 관련 캐시 무효화
   */
  async invalidateDeviceCache(): Promise<void> {
    await this.delPattern('devices:*');
    this.logger.info('Device cache invalidated');
  }

  /**
   * 장비 하트비트 타임스탬프 업데이트
   */
  async updateHeartbeat(deviceId: string): Promise<void> {
    const key = `device:heartbeat:${deviceId}`;
    const timestamp = new Date().toISOString();
    
    try {
      await this.set(key, timestamp, 120); // 2분 TTL
      this.logger.debug('Heartbeat updated', { deviceId, timestamp });
    } catch (error) {
      this.logger.error('Failed to update heartbeat', error, { deviceId });
    }
  }

  /**
   * 헬스 체크
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      this.logger.error('Cache health check failed', error);
      return false;
    }
  }
}
