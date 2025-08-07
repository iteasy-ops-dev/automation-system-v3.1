/**
 * Base Repository - 모든 Repository의 기본 클래스
 * TASK-4-PRISMA 패턴을 100% 재사용하여 구현
 * 
 * @file src/repositories/base.repository.ts
 * @description 공통 Repository 기능과 패턴 제공
 * @author Backend Team - Domains
 */

import { PrismaClient } from '@prisma/client';
import { CacheService } from '../services/cache.service';
import { createLogger } from '../utils/logger';
import { Repository, QueryOptions, PaginatedResult, CacheOptions } from '../types/repository.types';

export abstract class BaseRepository<T, ID = string> implements Repository<T, ID> {
  protected prisma: PrismaClient;
  protected cache: CacheService;
  protected logger = createLogger();
  
  // 각 Repository에서 구현해야 하는 추상 속성
  protected abstract readonly entityName: string;
  protected abstract readonly cachePrefix: string;
  protected abstract readonly defaultTTL: number; // 기본 캐시 TTL (초)

  constructor(prisma: PrismaClient, cache: CacheService) {
    this.prisma = prisma;
    this.cache = cache;
  }

  /**
   * 캐시 키 생성
   */
  protected getCacheKey(id: ID): string {
    return `${this.cachePrefix}:${id}`;
  }

  /**
   * 리스트 캐시 키 생성
   */
  protected getListCacheKey(filters: Record<string, any>): string {
    const sortedFilters = Object.keys(filters)
      .sort()
      .reduce((result, key) => {
        result[key] = filters[key];
        return result;
      }, {} as Record<string, any>);

    const filterString = JSON.stringify(sortedFilters);
    const hash = this.createSimpleHash(filterString);
    return `${this.cachePrefix}:list:${hash}`;
  }

  /**
   * 간단한 해시 생성
   */
  private createSimpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32비트 정수로 변환
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 캐시에서 데이터 조회
   */
  protected async getFromCache<R = T>(key: string): Promise<R | null> {
    try {
      const cached = await this.cache.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      this.logger.warn(`Cache get failed for key ${key}:`, error);
      return null;
    }
  }

  /**
   * 캐시에 데이터 저장
   */
  protected async setToCache<R = T>(
    key: string, 
    data: R, 
    options: CacheOptions = {}
  ): Promise<void> {
    try {
      const ttl = options.ttl || this.defaultTTL;
      await this.cache.set(key, JSON.stringify(data));
    } catch (error) {
      this.logger.warn(`Cache set failed for key ${key}:`, error);
    }
  }

  /**
   * 캐시에서 데이터 삭제
   */
  protected async removeFromCache(key: string): Promise<void> {
    try {
      await this.cache.del(key);
    } catch (error) {
      this.logger.warn(`Cache delete failed for key ${key}:`, error);
    }
  }

  /**
   * 여러 캐시 키 삭제 (패턴 기반)
   */
  protected async invalidateCache(pattern: string): Promise<void> {
    try {
      const keys = await this.cache.keys(`${this.cachePrefix}:${pattern}*`);
      if (keys.length > 0) {
        await this.cache.del(...keys);
      }
    } catch (error) {
      this.logger.warn(`Cache invalidation failed for pattern ${pattern}:`, error);
    }
  }

  /**
   * 페이지네이션 결과 생성
   */
  protected createPaginatedResult<R = T>(
    items: R[],
    total: number,
    options: QueryOptions
  ): PaginatedResult<R> {
    const limit = options.limit || 20;
    const offset = options.offset || 0;
    
    return {
      items,
      total,
      limit,
      offset,
      hasNext: offset + limit < total,
      hasPrev: offset > 0,
      totalPages: Math.ceil(total / limit),
      currentPage: Math.floor(offset / limit) + 1
    };
  }

  /**
   * WHERE 조건 빌더 헬퍼
   */
  protected buildWhereClause(filters: Record<string, any>): Record<string, any> {
    const where: Record<string, any> = {};

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          where[key] = { in: value };
        } else if (typeof value === 'string' && key.includes('search')) {
          where[key] = { contains: value, mode: 'insensitive' };
        } else {
          where[key] = value;
        }
      }
    });

    return where;
  }

  /**
   * ORDER BY 조건 빌더 헬퍼
   */
  protected buildOrderBy(options: QueryOptions): Record<string, any>[] {
    if (!options.sortBy) {
      return [{ createdAt: 'desc' }]; // 기본 정렬
    }

    const direction = options.sortDirection || 'asc';
    return [{ [options.sortBy]: direction }];
  }

  /**
   * 에러 처리 헬퍼
   */
  protected handleError(operation: string, error: Error, context?: any): never {
    const errorContext = {
      operation,
      entityName: this.entityName,
      ...context
    };

    this.logger.error(`${this.entityName} ${operation} failed:`, {
      error: error.message,
      stack: error.stack,
      context: errorContext
    });

    // Prisma 특정 에러 변환
    if (error.message.includes('P2002')) {
      throw new Error(`Unique constraint violation in ${operation}`);
    }
    
    if (error.message.includes('P2025')) {
      throw new Error(`Record not found in ${operation}`);
    }

    if (error.message.includes('P2003')) {
      throw new Error(`Foreign key constraint violation in ${operation}`);
    }

    throw error;
  }

  /**
   * 트랜잭션 실행 헬퍼
   */
  protected async executeInTransaction<R>(
    operation: (tx: PrismaClient) => Promise<R>
  ): Promise<R> {
    try {
      return await this.prisma.$transaction(operation);
    } catch (error) {
      this.handleError('transaction', error as Error);
    }
  }

  /**
   * 배치 작업 헬퍼
   */
  protected async executeBatch<R>(
    operations: (() => Promise<R>)[],
    batchSize: number = 100
  ): Promise<R[]> {
    const results: R[] = [];
    
    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(op => op()));
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * 헬스체크
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error(`${this.entityName} repository health check failed:`, error);
      return false;
    }
  }

  /**
   * 연결 종료
   */
  async disconnect(): Promise<void> {
    try {
      await this.prisma.$disconnect();
    } catch (error) {
      this.logger.warn(`${this.entityName} repository disconnect failed:`, error);
    }
  }
}
