/**
 * Base Repository Interface
 * 계약 기반 통합 데이터 액세스 레이어 기본 인터페이스
 * 모든 Repository는 이 인터페이스를 구현해야 함
 */

export interface IBaseRepository<T, ID = string> {
  // 기본 CRUD 연산
  findById(id: ID): Promise<T | null>;
  findAll(options?: QueryOptions): Promise<PaginatedResult<T>>;
  create(entity: Partial<T>): Promise<T>;
  update(id: ID, entity: Partial<T>): Promise<T>;
  delete(id: ID): Promise<boolean>;
  
  // 배치 연산
  createMany(entities: Partial<T>[]): Promise<T[]>;
  updateMany(filter: FilterOptions, entity: Partial<T>): Promise<number>;
  deleteMany(filter: FilterOptions): Promise<number>;
  
  // 트랜잭션 지원
  executeInTransaction<R>(callback: (trx: any) => Promise<R>): Promise<R>;
  
  // 캐시 관리
  invalidateCache(key?: string): Promise<void>;
  getCacheKey(id: ID): string;
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  sort?: Record<string, 'asc' | 'desc'>;
  filter?: FilterOptions;
  include?: string[];
}

export interface FilterOptions {
  [key: string]: any;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface CacheOptions {
  ttl?: number;
  key?: string;
  tags?: string[];
}

export abstract class BaseRepository<T, ID = string> implements IBaseRepository<T, ID> {
  protected abstract entityName: string;
  protected abstract cachePrefix: string;
  
  constructor(
    protected dataSource: any,
    protected cache: any,
    protected logger: any
  ) {}

  abstract findById(id: ID): Promise<T | null>;
  abstract findAll(options?: QueryOptions): Promise<PaginatedResult<T>>;
  abstract create(entity: Partial<T>): Promise<T>;
  abstract update(id: ID, entity: Partial<T>): Promise<T>;
  abstract delete(id: ID): Promise<boolean>;
  abstract createMany(entities: Partial<T>[]): Promise<T[]>;
  abstract updateMany(filter: FilterOptions, entity: Partial<T>): Promise<number>;
  abstract deleteMany(filter: FilterOptions): Promise<number>;
  abstract executeInTransaction<R>(callback: (trx: any) => Promise<R>): Promise<R>;

  /**
   * 캐시 키 생성
   */
  getCacheKey(id: ID): string {
    return `${this.cachePrefix}:${id}`;
  }

  /**
   * 리스트 캐시 키 생성
   */
  getListCacheKey(options?: QueryOptions): string {
    const hash = this.hashOptions(options);
    return `${this.cachePrefix}:list:${hash}`;
  }

  /**
   * 캐시 무효화
   */
  async invalidateCache(key?: string): Promise<void> {
    try {
      if (key) {
        await this.cache.del(key);
      } else {
        // 엔티티 관련 모든 캐시 삭제
        const pattern = `${this.cachePrefix}:*`;
        const keys = await this.cache.keys(pattern);
        if (keys.length > 0) {
          await this.cache.del(...keys);
        }
      }
      this.logger.debug(`Cache invalidated for ${this.entityName}`, { key });
    } catch (error) {
      this.logger.error(`Cache invalidation failed for ${this.entityName}`, { error, key });
    }
  }

  /**
   * 옵션을 해시로 변환
   */
  private hashOptions(options?: QueryOptions): string {
    if (!options) return 'default';
    return Buffer.from(JSON.stringify(options)).toString('base64').substring(0, 16);
  }

  /**
   * 페이지네이션 결과 생성
   */
  protected createPaginatedResult<T>(
    items: T[],
    total: number,
    limit: number = 20,
    offset: number = 0
  ): PaginatedResult<T> {
    return {
      items,
      total,
      limit,
      offset,
      hasNext: offset + limit < total,
      hasPrev: offset > 0
    };
  }

  /**
   * 에러 로깅 및 재발생
   */
  protected handleError(operation: string, error: any, context?: any): never {
    this.logger.error(`${this.entityName} ${operation} failed`, {
      error: error.message,
      stack: error.stack,
      context
    });
    throw error;
  }
}
