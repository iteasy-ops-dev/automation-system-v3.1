/**
 * Prisma 기반 Device Repository
 * 계약 준수: shared/contracts/v1.0/rest/core/storage-api.yaml 100% 일치
 * 기존 TASK-4 로직 유지 + Prisma ORM 활용
 */

import { PrismaClient, Device, DeviceGroup } from '@prisma/client';
import { CacheService } from '../services/cache.service';
import { Logger } from '../utils/logger';

// ========================================
// 타입 정의 (계약 기반) - Enum 직접 정의
// ========================================

export type DeviceType = 'server' | 'network' | 'storage' | 'iot';
export type DeviceStatus = 'active' | 'inactive' | 'maintenance';

export interface DeviceFilter {
  groupId?: string;
  status?: DeviceStatus;
  type?: DeviceType;
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface DeviceListResponse {
  items: Device[];
  total: number;
  limit: number;
  offset: number;
}

export interface DeviceCreateData {
  name: string;
  type: DeviceType;
  groupId?: string;
  metadata?: Record<string, any>;
  tags?: string[];
}

export interface DeviceUpdateData {
  name?: string;
  status?: DeviceStatus;
  groupId?: string;
  metadata?: Record<string, any>;
  tags?: string[];
}

export interface DeviceGroupFilter {
  parentId?: string;
  limit?: number;
  offset?: number;
}

export interface DeviceGroupListResponse {
  items: DeviceGroup[];
  total: number;
  limit: number;
  offset: number;
}

export interface DeviceGroupCreateData {
  name: string;
  description?: string;
  parentId?: string;
  metadata?: Record<string, any>;
}

// ========================================
// Repository 구현
// ========================================

export class DeviceRepository {
  private readonly cachePrefix = 'api:device';
  private readonly listCachePrefix = 'api:devices:list';
  private readonly groupCachePrefix = 'api:groups';

  constructor(
    private readonly prisma: PrismaClient,
    private readonly cache: CacheService,
    private readonly logger: Logger
  ) {}

  // ========================================
  // Device CRUD Operations (계약 100% 준수)
  // ========================================

  /**
   * GET /storage/devices - 장비 목록 조회
   * 계약 준수: DeviceListResponse 반환
   */
  async findDevices(filters: DeviceFilter): Promise<DeviceListResponse> {
    try {
      // 캐시 키 생성
      const cacheKey = this.getListCacheKey(filters);
      const cached = await this.cache.get<DeviceListResponse>(cacheKey);
      if (cached) {
        this.logger.debug('Device list cache hit', { filters, cacheKey });
        return cached;
      }

      // Prisma 쿼리 빌드
      const where = this.buildWhereClause(filters);
      const orderBy = this.buildOrderBy(filters);
      
      // 병렬 실행으로 성능 최적화
      const [items, total] = await Promise.all([
        this.prisma.device.findMany({
          where,
          orderBy,
          skip: filters.offset || 0,
          take: filters.limit || 20,
          include: {
            group: true // DeviceGroup 포함
          }
        }),
        this.prisma.device.count({ where })
      ]);

      const result: DeviceListResponse = {
        items,
        total,
        limit: filters.limit || 20,
        offset: filters.offset || 0
      };

      // 캐시 저장 (30초 TTL)
      await this.cache.setex(cacheKey, 30, result);

      this.logger.info('Device list retrieved', { 
        count: items.length, 
        total, 
        filters 
      });

      return result;
    } catch (error: any) {
      this.logger.error('Failed to retrieve device list', { 
        filters, 
        error: error.message 
      });
      throw this.handleError('findDevices', error);
    }
  }

  /**
   * GET /storage/devices/{id} - 장비 상세 조회
   * 계약 준수: Device 반환 또는 404
   */
  async findDeviceById(id: string): Promise<Device | null> {
    try {
      // 캐시 확인
      const cacheKey = `${this.cachePrefix}:${id}`;
      const cached = await this.cache.get<Device>(cacheKey);
      if (cached) {
        this.logger.debug('Device cache hit', { id, cacheKey });
        return cached;
      }

      // Prisma 쿼리
      const device = await this.prisma.device.findUnique({
        where: { id },
        include: {
          group: true,
          statusHistory: {
            orderBy: { changedAt: 'desc' },
            take: 5 // 최근 5개 상태 변경 이력
          }
        }
      });

      if (device) {
        // 캐시 저장 (60초 TTL)
        await this.cache.setex(cacheKey, 60, device);
        this.logger.debug('Device found and cached', { id });
      } else {
        this.logger.warn('Device not found', { id });
      }

      return device;
    } catch (error: any) {
      this.logger.error('Failed to retrieve device', { id, error: error.message });
      throw this.handleError('findDeviceById', error);
    }
  }

  /**
   * POST /storage/devices - 장비 등록
   * 계약 준수: Device 반환, 중복시 409 에러
   */
  async createDevice(data: DeviceCreateData): Promise<Device> {
    try {
      // 중복 이름 검사
      const existing = await this.prisma.device.findUnique({
        where: { name: data.name }
      });

      if (existing) {
        const error = new Error(`Device with name '${data.name}' already exists`);
        (error as any).name = 'DEVICE_NAME_CONFLICT';
        throw error;
      }

      // 그룹 존재 확인 (groupId가 제공된 경우)
      if (data.groupId) {
        const group = await this.prisma.deviceGroup.findUnique({
          where: { id: data.groupId }
        });
        
        if (!group) {
          const error = new Error(`Device group '${data.groupId}' not found`);
          (error as any).name = 'DEVICE_GROUP_NOT_FOUND';
          throw error;
        }
      }

      // 디바이스 생성
      const device = await this.prisma.device.create({
        data: {
          name: data.name,
          type: data.type,
          groupId: data.groupId,
          metadata: data.metadata || {},
          tags: data.tags || [],
          status: 'active' as any // 기본값
        },
        include: {
          group: true
        }
      });

      // 캐시 무효화
      await this.invalidateDeviceCaches();

      this.logger.info('Device created', { 
        id: device.id, 
        name: device.name, 
        type: device.type 
      });

      return device;
    } catch (error: any) {
      this.logger.error('Failed to create device', { data, error: error.message });
      throw this.handleError('createDevice', error);
    }
  }

  /**
   * PUT /storage/devices/{id} - 장비 정보 수정
   * 계약 준수: Device 반환 또는 404
   */
  async updateDevice(id: string, data: DeviceUpdateData): Promise<Device | null> {
    try {
      // 기존 장비 확인
      const existing = await this.prisma.device.findUnique({ where: { id } });
      if (!existing) {
        return null;
      }

      // 이름 중복 검사 (다른 장비와 중복되는지)
      if (data.name && data.name !== existing.name) {
        const conflict = await this.prisma.device.findFirst({
          where: { 
            name: data.name,
            id: { not: id }
          }
        });
        
        if (conflict) {
          const error = new Error(`Device with name '${data.name}' already exists`);
          (error as any).name = 'DEVICE_NAME_CONFLICT';
          throw error;
        }
      }

      // 그룹 존재 확인
      if (data.groupId) {
        const group = await this.prisma.deviceGroup.findUnique({
          where: { id: data.groupId }
        });
        
        if (!group) {
          const error = new Error(`Device group '${data.groupId}' not found`);
          (error as any).name = 'DEVICE_GROUP_NOT_FOUND';
          throw error;
        }
      }

      // 상태 변경 이력 기록 (상태가 변경된 경우)
      if (data.status && data.status !== existing.status) {
        await this.prisma.deviceStatusHistory.create({
          data: {
            deviceId: id,
            previousStatus: existing.status,
            currentStatus: data.status,
            reason: 'Updated via API',
            changedAt: new Date()
          }
        });
      }

      // 장비 업데이트
      const device = await this.prisma.device.update({
        where: { id },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.status && { status: data.status as any }),
          ...(data.groupId !== undefined && { groupId: data.groupId }),
          ...(data.metadata && { metadata: data.metadata }),
          ...(data.tags && { tags: data.tags }),
          updatedAt: new Date()
        },
        include: {
          group: true
        }
      });

      // 캐시 무효화
      await this.invalidateDeviceCaches(id);

      this.logger.info('Device updated', { 
        id, 
        changes: Object.keys(data),
        name: device.name 
      });

      return device;
    } catch (error: any) {
      this.logger.error('Failed to update device', { id, data, error: error.message });
      throw this.handleError('updateDevice', error);
    }
  }

  /**
   * DELETE /storage/devices/{id} - 장비 삭제
   * 계약 준수: boolean 반환
   */
  async deleteDevice(id: string): Promise<boolean> {
    try {
      // 기존 장비 확인
      const existing = await this.prisma.device.findUnique({ where: { id } });
      if (!existing) {
        return false;
      }

      // 관련 데이터와 함께 삭제 (CASCADE)
      await this.prisma.device.delete({
        where: { id }
      });

      // 캐시 무효화
      await this.invalidateDeviceCaches(id);

      this.logger.info('Device deleted', { 
        id, 
        name: existing.name 
      });

      return true;
    } catch (error: any) {
      this.logger.error('Failed to delete device', { id, error: error.message });
      throw this.handleError('deleteDevice', error);
    }
  }

  // ========================================
  // Device Group Operations (계약 준수)
  // ========================================

  /**
   * GET /storage/device-groups - 그룹 목록 조회
   */
  async findDeviceGroups(filters: DeviceGroupFilter): Promise<DeviceGroupListResponse> {
    try {
      const cacheKey = `${this.groupCachePrefix}:list:${JSON.stringify(filters)}`;
      const cached = await this.cache.get<DeviceGroupListResponse>(cacheKey);
      if (cached) {
        return cached;
      }

      const where: any = {};
      if (filters.parentId !== undefined) {
        where.parentId = filters.parentId;
      }

      const [items, total] = await Promise.all([
        this.prisma.deviceGroup.findMany({
          where,
          orderBy: { name: 'asc' },
          skip: filters.offset || 0,
          take: filters.limit || 20,
          include: {
            parent: true,
            children: true,
            devices: {
              select: { id: true, name: true, status: true }
            }
          }
        }),
        this.prisma.deviceGroup.count({ where })
      ]);

      const result: DeviceGroupListResponse = {
        items,
        total,
        limit: filters.limit || 20,
        offset: filters.offset || 0
      };

      // 캐시 저장 (5분 TTL)
      await this.cache.setex(cacheKey, 300, result);

      return result;
    } catch (error: any) {
      this.logger.error('Failed to retrieve device groups', { filters, error: error.message });
      throw this.handleError('findDeviceGroups', error);
    }
  }

  /**
   * POST /storage/device-groups - 그룹 생성
   */
  async createDeviceGroup(data: DeviceGroupCreateData): Promise<DeviceGroup> {
    try {
      // 같은 부모 하에서 이름 중복 검사
      const existing = await this.prisma.deviceGroup.findFirst({
        where: {
          name: data.name,
          parentId: data.parentId || null
        }
      });

      if (existing) {
        const error = new Error(`Device group with name '${data.name}' already exists in the same parent`);
        (error as any).name = 'DEVICE_GROUP_NAME_CONFLICT';
        throw error;
      }

      // 부모 그룹 존재 확인
      if (data.parentId) {
        const parent = await this.prisma.deviceGroup.findUnique({
          where: { id: data.parentId }
        });
        
        if (!parent) {
          const error = new Error(`Parent group '${data.parentId}' not found`);
          (error as any).name = 'PARENT_GROUP_NOT_FOUND';
          throw error;
        }
      }

      const group = await this.prisma.deviceGroup.create({
        data: {
          name: data.name,
          description: data.description,
          parentId: data.parentId,
          metadata: data.metadata || {}
        },
        include: {
          parent: true
        }
      });

      // 캐시 무효화
      await this.cache.invalidateByTag('group');

      this.logger.info('Device group created', { 
        id: group.id, 
        name: group.name,
        parentId: group.parentId 
      });

      return group;
    } catch (error: any) {
      this.logger.error('Failed to create device group', { data, error: error.message });
      throw this.handleError('createDeviceGroup', error);
    }
  }

  // ========================================
  // Private Helper Methods
  // ========================================

  /**
   * 캐시 키 생성 (목록용)
   */
  private getListCacheKey(filters: DeviceFilter): string {
    const key = `${this.listCachePrefix}:${JSON.stringify(filters)}`;
    return key;
  }

  /**
   * WHERE 조건 빌드 (Prisma용)
   */
  private buildWhereClause(filters: DeviceFilter): any {
    const where: any = {};

    if (filters.groupId) {
      where.groupId = filters.groupId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { tags: { has: filters.search } }
      ];
    }

    return where;
  }

  /**
   * ORDER BY 조건 빌드 (Prisma용)
   */
  private buildOrderBy(filters: DeviceFilter): any {
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder || 'desc';

    return { [sortBy]: sortOrder };
  }

  /**
   * 장비 관련 캐시 무효화
   */
  private async invalidateDeviceCaches(deviceId?: string): Promise<void> {
    try {
      // 태그 기반 무효화
      await this.cache.invalidateByTags(['device', 'list']);

      // 특정 장비 캐시 삭제
      if (deviceId) {
        await this.cache.delete(`${this.cachePrefix}:${deviceId}`);
      }

      this.logger.debug('Device caches invalidated', { deviceId });
    } catch (error: any) {
      this.logger.warn('Failed to invalidate device caches', { 
        deviceId, 
        error: error.message 
      });
    }
  }

  /**
   * 에러 처리 및 변환
   */
  private handleError(operation: string, error: any): Error {
    // Prisma 특정 에러 처리
    if (error.code === 'P2002') {
      // Unique constraint violation
      const constraintError = new Error('Unique constraint violation');
      (constraintError as any).name = 'UNIQUE_CONSTRAINT_VIOLATION';
      return constraintError;
    }

    if (error.code === 'P2025') {
      // Record not found
      const notFoundError = new Error('Record not found');
      (notFoundError as any).name = 'RECORD_NOT_FOUND';
      return notFoundError;
    }

    // 기존 에러가 이미 적절한 타입인 경우
    if (error.name && error.name.includes('_')) {
      return error;
    }

    // 일반 에러 래핑
    const wrappedError = new Error(`${operation} failed: ${error.message}`);
    (wrappedError as any).name = 'REPOSITORY_ERROR';
    return wrappedError;
  }

  // ========================================
  // Public Utility Methods
  // ========================================

  /**
   * 장비 통계 조회
   */
  async getDeviceStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
  }> {
    try {
      const cacheKey = 'api:device:stats';
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const [
        total,
        statusStats,
        typeStats
      ] = await Promise.all([
        this.prisma.device.count(),
        this.prisma.device.groupBy({
          by: ['status'],
          _count: { status: true }
        }),
        this.prisma.device.groupBy({
          by: ['type'],
          _count: { type: true }
        })
      ]);

      const byStatus: Record<string, number> = {};
      statusStats.forEach(stat => {
        byStatus[stat.status] = stat._count.status;
      });

      const byType: Record<string, number> = {};
      typeStats.forEach(stat => {
        byType[stat.type] = stat._count.type;
      });

      const stats = { total, byStatus, byType };

      // 캐시 저장 (5분 TTL)
      await this.cache.setex(cacheKey, 300, stats);

      return stats;
    } catch (error: any) {
      this.logger.error('Failed to get device stats', { error: error.message });
      throw this.handleError('getDeviceStats', error);
    }
  }

  /**
   * 헬스체크
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.device.count();
      return true;
    } catch (error: any) {
      this.logger.error('Device repository health check failed', { error: error.message });
      return false;
    }
  }
}
