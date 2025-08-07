/**
 * Repository Types - Repository 레이어 타입 정의
 * 
 * @file src/types/repository.types.ts
 * @description Repository 인터페이스와 공통 타입들
 * @author Backend Team - Domains
 */

export interface Repository<T, ID = string> {
  healthCheck(): Promise<boolean>;
  disconnect(): Promise<void>;
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasNext: boolean;
  hasPrev: boolean;
  totalPages: number;
  currentPage: number;
}

export interface CacheOptions {
  ttl?: number; // TTL in seconds
  skipCache?: boolean;
  invalidatePattern?: string;
}

export interface DeviceFilter {
  id?: string;
  name?: string;
  type?: string | string[];
  status?: string | string[];
  groupId?: string;
  tags?: string[];
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface DeviceStatusFilter {
  deviceId?: string;
  status?: string | string[];
  changedBy?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

export interface DeviceGroupFilter {
  id?: string;
  name?: string;
  parentId?: string;
  hasParent?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}
