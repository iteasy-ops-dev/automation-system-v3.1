/**
 * Base Repository - MCP Integration Service
 * TASK-4-PRISMA 패턴 적용된 기본 Repository 클래스
 */

import { Logger } from '../utils/logger';
import { CacheService } from '../services/cache.service';
import { db } from '../utils/database';

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

export abstract class BaseRepository<T, ID> {
  protected logger: Logger;
  protected cache: CacheService;
  protected abstract entityName: string;
  protected abstract cachePrefix: string;

  constructor(cache: CacheService, logger: Logger) {
    this.cache = cache;
    this.logger = logger;
  }

  /**
   * ID로 단일 엔터티 조회 (캐시 우선)
   */
  async findById(id: ID, useCache: boolean = true): Promise<T | null> {
    const cacheKey = this.getEntityCacheKey(id);
    
    if (useCache) {
      const cached = await this.cache.get<T>(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for ${this.entityName}: ${id}`);
        return cached;
      }
    }

    try {
      const entity = await this.findByIdFromDatabase(id);
      
      if (entity && useCache) {
        await this.cache.set(cacheKey, entity, 600); // 10분 캐시
      }
      
      return entity;
    } catch (error) {
      this.logger.error(`Failed to find ${this.entityName} by ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * 엔터티 생성
   */
  async create(data: Partial<T>): Promise<T> {
    try {
      const entity = await this.createInDatabase(data);
      
      // 캐시 무효화
      await this.invalidateRelatedCache();
      
      this.logger.info(`Created ${this.entityName}:`, { id: this.getEntityId(entity) });
      return entity;
    } catch (error) {
      this.logger.error(`Failed to create ${this.entityName}:`, error);
      throw error;
    }
  }

  /**
   * 엔터티 업데이트
   */
  async update(id: ID, data: Partial<T>): Promise<T> {
    try {
      const entity = await this.updateInDatabase(id, data);
      
      // 캐시 무효화
      await this.cache.del(this.getEntityCacheKey(id));
      await this.invalidateRelatedCache();
      
      this.logger.info(`Updated ${this.entityName}:`, { id });
      return entity;
    } catch (error) {
      this.logger.error(`Failed to update ${this.entityName} ${id}:`, error);
      throw error;
    }
  }

  /**
   * 엔터티 삭제
   */
  async delete(id: ID): Promise<boolean> {
    try {
      const success = await this.deleteFromDatabase(id);
      
      if (success) {
        // 캐시 무효화
        await this.cache.del(this.getEntityCacheKey(id));
        await this.invalidateRelatedCache();
        
        this.logger.info(`Deleted ${this.entityName}:`, { id });
      }
      
      return success;
    } catch (error) {
      this.logger.error(`Failed to delete ${this.entityName} ${id}:`, error);
      throw error;
    }
  }

  /**
   * 페이지네이션된 목록 조회
   */
  async findMany(options: QueryOptions = {}): Promise<PaginatedResult<T>> {
    const { limit = 20, offset = 0 } = options;
    const cacheKey = this.getListCacheKey(options);
    
    // 캐시 조회
    const cached = await this.cache.get<PaginatedResult<T>>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for ${this.entityName} list`);
      return cached;
    }

    try {
      const result = await this.findManyFromDatabase(options);
      
      // 캐시 저장 (2분)
      await this.cache.set(cacheKey, result, 120);
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to find ${this.entityName} list:`, error);
      throw error;
    }
  }

  /**
   * 조건부 조회
   */
  async findWhere(conditions: Partial<T>, options: QueryOptions = {}): Promise<T[]> {
    try {
      return await this.findWhereFromDatabase(conditions, options);
    } catch (error) {
      this.logger.error(`Failed to find ${this.entityName} where:`, error);
      throw error;
    }
  }

  /**
   * 개수 조회
   */
  async count(conditions?: Partial<T>): Promise<number> {
    try {
      return await this.countFromDatabase(conditions);
    } catch (error) {
      this.logger.error(`Failed to count ${this.entityName}:`, error);
      throw error;
    }
  }

  // Abstract methods - 구현 클래스에서 구현 필요
  protected abstract findByIdFromDatabase(id: ID): Promise<T | null>;
  protected abstract createInDatabase(data: Partial<T>): Promise<T>;
  protected abstract updateInDatabase(id: ID, data: Partial<T>): Promise<T>;
  protected abstract deleteFromDatabase(id: ID): Promise<boolean>;
  protected abstract findManyFromDatabase(options: QueryOptions): Promise<PaginatedResult<T>>;
  protected abstract findWhereFromDatabase(conditions: Partial<T>, options: QueryOptions): Promise<T[]>;
  protected abstract countFromDatabase(conditions?: Partial<T>): Promise<number>;
  protected abstract getEntityId(entity: T): ID;

  // Cache helper methods
  protected getEntityCacheKey(id: ID): string {
    return `${this.cachePrefix}:${id}`;
  }

  protected getListCacheKey(options: QueryOptions): string {
    const optionsStr = JSON.stringify(options);
    const hash = Buffer.from(optionsStr).toString('base64').slice(0, 16);
    return `${this.cachePrefix}:list:${hash}`;
  }

  protected async invalidateRelatedCache(): Promise<void> {
    await this.cache.deleteByPattern(`${this.cachePrefix}:list:*`);
  }

  /**
   * 캐시 무효화
   */
  async invalidateCache(id?: ID): Promise<void> {
    if (id) {
      await this.cache.del(this.getEntityCacheKey(id));
    }
    await this.invalidateRelatedCache();
  }

  /**
   * 에러 처리 헬퍼
   */
  protected handleError(operation: string, error: any, context?: any): never {
    this.logger.error(`${this.entityName} ${operation} failed:`, {
      error: error.message,
      stack: error.stack,
      context
    });
    
    throw error;
  }
}