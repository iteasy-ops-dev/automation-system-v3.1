/**
 * Device Repository - Device Management Service
 * 계약(shared/contracts/v1.0/rest/domain/device-service.yaml) 100% 준수
 * TASK-8 성공 패턴 적용: BaseRepository + Prisma + 캐싱
 */

import { BaseRepository, QueryOptions, PaginatedResult } from './base.repository';
import { CacheService } from '../services/cache.service';
import { Logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';
import {
  Device,
  DeviceListQuery,
  DeviceListResponse,
  DeviceCreateRequest,
  DeviceUpdateRequest,
  DeviceGroup,
  DeviceNotFoundError,
  DeviceServiceError
} from '../types';

export class DeviceRepository extends BaseRepository<Device, string> {
  protected entityName = 'Device';
  protected cachePrefix = 'device';
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient, cache: CacheService, logger: Logger) {
    super(cache, logger);
    this.prisma = prisma;
  }

  /**
   * 장비 목록 조회 (계약 준수: GET /devices)
   */
  async findDevices(filters: DeviceListQuery): Promise<DeviceListResponse> {
    try {
      const cacheKey = this.getFilteredListCacheKey(filters);
      const cached = await this.cache.get<DeviceListResponse>(cacheKey);
      if (cached) {
        this.logger.debug('Cache hit for devices list', { filters });
        return cached;
      }

      // 동적 WHERE 절 구성
      const where = this.buildWhereClause(filters);
      const orderBy = { createdAt: 'desc' as const };

      // Prisma 쿼리 실행
      const [items, total] = await Promise.all([
        this.prisma.device.findMany({
          where,
          orderBy,
          skip: filters.offset || 0,
          take: filters.limit || 20,
          include: {
            group: true, // 그룹 정보 포함
          }
        }),
        this.prisma.device.count({ where })
      ]);

      const result: DeviceListResponse = {
        items: items.map(this.mapPrismaToDevice),
        total,
        limit: filters.limit || 20,
        offset: filters.offset || 0
      };

      // 캐시 저장 (5분 TTL)
      await this.cache.setex(cacheKey, 300, result);

      this.logger.info('Devices retrieved successfully', {
        count: items.length,
        total,
        filters
      });

      return result;
    } catch (error) {
      this.logger.error('Error retrieving devices', { error, filters });
      throw new DeviceServiceError(
        'Failed to retrieve devices',
        'DEVICE_QUERY_ERROR',
        500,
        { filters, error: (error as Error).message }
      );
    }
  }

  /**
   * 장비 ID로 조회 (계약 준수: GET /devices/{id})
   */
  async findDeviceById(id: string): Promise<Device> {
    try {
      const cacheKey = this.getSingleItemCacheKey(id);
      const cached = await this.cache.get<Device>(cacheKey);
      if (cached) {
        this.logger.debug('Cache hit for device', { deviceId: id });
        return cached;
      }

      const device = await this.prisma.device.findUnique({
        where: { id },
        include: {
          group: true,
        }
      });

      if (!device) {
        throw new DeviceNotFoundError(id);
      }

      const result = this.mapPrismaToDevice(device);

      // 캐시 저장 (2분 TTL)
      await this.cache.setex(cacheKey, 120, result);

      this.logger.debug('Device retrieved successfully', { deviceId: id });
      return result;
    } catch (error) {
      if (error instanceof DeviceNotFoundError) {
        throw error;
      }
      this.logger.error('Error retrieving device', { error, deviceId: id });
      throw new DeviceServiceError(
        `Failed to retrieve device ${id}`,
        'DEVICE_QUERY_ERROR',
        500,
        { deviceId: id, error: (error as Error).message }
      );
    }
  }

  /**
   * 장비 생성 (계약 준수: POST /devices)
   */
  async createDevice(data: DeviceCreateRequest): Promise<Device> {
    try {
      // 이름 중복 체크
      const existing = await this.prisma.device.findFirst({
        where: { name: data.name }
      });

      if (existing) {
        throw new DeviceServiceError(
          `Device with name '${data.name}' already exists`,
          'DEVICE_NAME_DUPLICATE',
          409,
          { name: data.name }
        );
      }

      // 그룹 존재 확인 (선택사항)
      if (data.groupId) {
        const group = await this.prisma.deviceGroup.findUnique({
          where: { id: data.groupId }
        });
        if (!group) {
          throw new DeviceServiceError(
            `Device group '${data.groupId}' not found`,
            'GROUP_NOT_FOUND',
            404,
            { groupId: data.groupId }
          );
        }
      }

      const device = await this.prisma.device.create({
        data: {
          name: data.name,
          type: data.type,
          groupId: data.groupId,
          metadata: data.metadata || {},
          tags: data.tags || [],
          status: 'active' // 기본값
        },
        include: {
          group: true,
        }
      });

      const result = this.mapPrismaToDevice(device);

      // 캐시 무효화
      await this.invalidateListCaches();

      this.logger.info('Device created successfully', {
        deviceId: device.id,
        name: data.name,
        type: data.type
      });

      return result;
    } catch (error) {
      if (error instanceof DeviceServiceError) {
        throw error;
      }
      this.logger.error('Error creating device', { error, data });
      throw new DeviceServiceError(
        'Failed to create device',
        'DEVICE_CREATE_ERROR',
        500,
        { data, error: (error as Error).message }
      );
    }
  }

  /**
   * 장비 정보 수정 (계약 준수: PUT /devices/{id})
   */
  async updateDevice(id: string, data: DeviceUpdateRequest): Promise<Device> {
    try {
      // 기존 장비 확인
      const existing = await this.findDeviceById(id);

      // 이름 중복 체크 (다른 장비와)
      if (data.name && data.name !== existing.name) {
        const nameExists = await this.prisma.device.findFirst({
          where: {
            name: data.name,
            id: { not: id }
          }
        });
        if (nameExists) {
          throw new DeviceServiceError(
            `Device with name '${data.name}' already exists`,
            'DEVICE_NAME_DUPLICATE',
            409,
            { name: data.name }
          );
        }
      }

      // 그룹 존재 확인
      if (data.groupId) {
        const group = await this.prisma.deviceGroup.findUnique({
          where: { id: data.groupId }
        });
        if (!group) {
          throw new DeviceServiceError(
            `Device group '${data.groupId}' not found`,
            'GROUP_NOT_FOUND',
            404,
            { groupId: data.groupId }
          );
        }
      }

      const device = await this.prisma.device.update({
        where: { id },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.groupId !== undefined && { groupId: data.groupId }),
          ...(data.metadata && { metadata: data.metadata }),
          ...(data.tags && { tags: data.tags }),
          updatedAt: new Date()
        },
        include: {
          group: true,
        }
      });

      const result = this.mapPrismaToDevice(device);

      // 캐시 무효화
      await this.invalidateCaches(id);

      this.logger.info('Device updated successfully', {
        deviceId: id,
        changes: Object.keys(data)
      });

      return result;
    } catch (error) {
      if (error instanceof DeviceServiceError) {
        throw error;
      }
      this.logger.error('Error updating device', { error, deviceId: id, data });
      throw new DeviceServiceError(
        `Failed to update device ${id}`,
        'DEVICE_UPDATE_ERROR',
        500,
        { deviceId: id, data, error: (error as Error).message }
      );
    }
  }

  /**
   * 그룹별 장비 수 조회
   */
  async getDeviceCountByGroup(): Promise<Record<string, number>> {
    try {
      const cacheKey = `${this.cachePrefix}:count_by_group`;
      const cached = await this.cache.get<Record<string, number>>(cacheKey);
      if (cached) {
        return cached;
      }

      const counts = await this.prisma.device.groupBy({
        by: ['groupId'],
        _count: true
      });

      const result: Record<string, number> = {};
      counts.forEach((count: any) => {
        const groupId = count.groupId || 'unassigned';
        result[groupId] = count._count;
      });

      // 10분 캐시
      await this.cache.setex(cacheKey, 600, result);

      return result;
    } catch (error) {
      this.logger.error('Error getting device count by group', { error });
      throw new DeviceServiceError(
        'Failed to get device count by group',
        'DEVICE_COUNT_ERROR',
        500,
        { error: (error as Error).message }
      );
    }
  }

  // ===== Private Helper Methods =====

  /**
   * Prisma 객체를 Device 타입으로 변환
   */
  private mapPrismaToDevice(prismaDevice: any): Device {
    return {
      id: prismaDevice.id,
      name: prismaDevice.name,
      type: prismaDevice.type,
      status: prismaDevice.status,
      groupId: prismaDevice.groupId,
      metadata: prismaDevice.metadata || {},
      tags: prismaDevice.tags || [],
      createdAt: prismaDevice.createdAt,
      updatedAt: prismaDevice.updatedAt
    };
  }

  /**
   * 필터를 Prisma WHERE 절로 변환
   */
  private buildWhereClause(filters: DeviceListQuery): any {
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

    if (filters.tags && filters.tags.length > 0) {
      where.tags = {
        hasEvery: filters.tags
      };
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { metadata: { path: ['description'], string_contains: filters.search } }
      ];
    }

    return where;
  }

  /**
   * 캐시 키 생성 (목록용)
   */
  private getFilteredListCacheKey(filters: DeviceListQuery): string {
    const filterHash = JSON.stringify(filters);
    return `${this.cachePrefix}:list:${Buffer.from(filterHash).toString('base64')}`;
  }

  /**
   * 캐시 키 생성 (단일 항목용)
   */
  private getSingleItemCacheKey(id: string): string {
    return `${this.cachePrefix}:${id}`;
  }

  /**
   * 관련 캐시 무효화
   */
  /**
   * 장비 삭제
   */
  async deleteDevice(id: string): Promise<void> {
    try {
      this.logger.info('Deleting device', { id });

      // 먼저 장비 존재 여부 확인
      const existingDevice = await this.findDeviceById(id);
      
      // 관련 데이터 삭제 (상태 이력, 하트비트 등)
      await this.prisma.$transaction(async (tx: any) => {
        // 상태 이력 삭제
        await tx.deviceStatusHistory.deleteMany({
          where: { deviceId: id }
        });

        // 하트비트 데이터 삭제
        await tx.deviceHeartbeat.deleteMany({
          where: { deviceId: id }
        });

        // 장비 삭제
        await tx.device.delete({
          where: { id }
        });
      });

      // 캐시 무효화
      await this.invalidateCaches(id);

      this.logger.info('Device deleted successfully', { id });
    } catch (error) {
      this.logger.error('Error deleting device', { error, deviceId: id });
      throw new DeviceServiceError(
        `Failed to delete device ${id}`,
        'DEVICE_DELETE_ERROR',
        500,
        { deviceId: id, error: (error as Error).message }
      );
    }
  }

  private handleError(operation: string, error: unknown, context?: any): never {
    const errorMessage = error instanceof Error ? (error as Error).message : 'Unknown error';
    this.logger.error(`Repository error in ${operation}`, { error, context });
    throw new DeviceServiceError(
      `Repository operation failed: ${operation}`,
      'REPOSITORY_ERROR',
      500,
      { operation, context, error: errorMessage }
    );
  }

  private async invalidateCaches(deviceId?: string): Promise<void> {
    const keys = [`${this.cachePrefix}:count_by_group`];
    
    if (deviceId) {
      keys.push(this.getSingleItemCacheKey(deviceId));
    }

    await this.invalidateListCaches();
    await Promise.all(keys.map(key => this.cache.del(key)));
  }

  /**
   * 목록 캐시 무효화
   */
  private async invalidateListCaches(): Promise<void> {
    // 목록 캐시는 패턴으로 삭제
    const pattern = `${this.cachePrefix}:list:*`;
    await this.cache.delPattern(pattern);
  }
}
