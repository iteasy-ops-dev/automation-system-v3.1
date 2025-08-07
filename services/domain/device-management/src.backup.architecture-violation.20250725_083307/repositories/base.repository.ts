/**
 * Base Repository - Device Management Service
 * 간단한 기본 Repository 클래스 (추상 메서드 제거)
 */

import { Logger } from '../utils/logger';
import { CacheService } from '../services/cache.service';

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: Record<string, 'asc' | 'desc'>;
  include?: Record<string, boolean>;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export class BaseRepository<T, ID> {
  protected logger: Logger;
  protected cache: CacheService;
  protected entityName: string = 'BaseEntity';
  protected cachePrefix: string = 'base';

  constructor(cache: CacheService, logger: Logger) {
    this.cache = cache;
    this.logger = logger;
  }

  /**
   * 기본 캐시 키 생성
   */
  protected generateCacheKey(id: ID): string {
    return `${this.cachePrefix}:${id}`;
  }

  /**
   * 목록 캐시 키 생성
   */
  protected generateListCacheKey(filters: any): string {
    const filterString = JSON.stringify(filters);
    return `${this.cachePrefix}:list:${Buffer.from(filterString).toString('base64')}`;
  }

  /**
   * 캐시에서 항목 조회
   */
  protected async getFromCache(key: string): Promise<T | null> {
    try {
      return await this.cache.get<T>(key);
    } catch (error) {
      this.logger.warn('Cache get failed', { key, error });
      return null;
    }
  }

  /**
   * 캐시에 항목 저장
   */
  protected async setCache(key: string, data: T, ttl: number = 300): Promise<void> {
    try {
      await this.cache.setex(key, ttl, data);
    } catch (error) {
      this.logger.warn('Cache set failed', { key, error });
    }
  }

  /**
   * 캐시에서 항목 삭제
   */
  protected async deleteFromCache(key: string): Promise<void> {
    try {
      await this.cache.del(key);
    } catch (error) {
      this.logger.warn('Cache delete failed', { key, error });
    }
  }
}
