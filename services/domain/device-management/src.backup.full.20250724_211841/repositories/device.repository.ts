/**
 * Device Repository - 장비 데이터 액세스 레이어
 * device-service.yaml 계약 100% 준수 구현
 * 
 * @file src/repositories/device.repository.ts
 * @description 장비 CRUD 및 상태 관리
 * @author Backend Team - Domains
 */

import { PrismaClient } from '@prisma/client';
import { BaseRepository } from './base.repository';
import { CacheService } from '../services/cache.service';
import { 
  DeviceFilter, 
  DeviceStatusFilter,
  PaginatedResult,
  QueryOptions 
} from '../types/repository.types';
import {
  Device,
  DeviceGroup,
  DeviceStatusHistory,
  DeviceWithGroup,
  DeviceWithHistory,
  DeviceCreateInput,
  DeviceUpdateInput,
  DeviceListResponse,
  DeviceStats,
  DeviceStatusUpdateInput
} from '../types/device.types';

export class DeviceRepository extends BaseRepository<Device, string> {
  protected readonly entityName = 'Device';
  protected readonly cachePrefix = 'device';
  protected readonly defaultTTL = 300; // 5분 캐시

  /**
   * 장비 목록 조회 (계약: device-service.yaml 100% 준수)
   * GET /storage/devices 지원
   */
  async findDevices(filters: DeviceFilter): Promise<DeviceListResponse> {
    try {
      // 캐시 키 생성
      const cacheKey = this.getListCacheKey(filters);
      
      // 캐시에서 조회 시도
      const cached = await this.getFromCache<DeviceListResponse>(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for devices list: ${cacheKey}`);
        return cached;
      }

      // Prisma 쿼리 구성
      const where = this.buildDeviceWhereClause(filters);
      const orderBy = this.buildOrderBy(filters);
      const take = filters.limit || 20;
      const skip = filters.offset || 0;

      // 병렬로 데이터와 총 개수 조회
      const [items, total] = await Promise.all([
        this.prisma.device.findMany({
          where,
          orderBy,
          take,
          skip,
          include: {
            group: {
              select: {
                id: true,
                name: true,
                description: true
              }
            }
          }
        }),
        this.prisma.device.count({ where })
      ]);

      // 응답 구성
      const result: DeviceListResponse = {
        items: items as DeviceWithGroup[],
        total,
        limit: take,
        offset: skip,
        hasNext: skip + take < total,
        hasPrev: skip > 0,
        totalPages: Math.ceil(total / take),
        currentPage: Math.floor(skip / take) + 1
      };

      // 캐시 저장 (30초 TTL)
      await this.setToCache(cacheKey, result, { ttl: 30 });

      this.logger.info(`Found ${items.length} devices (total: ${total})`);
      return result;

    } catch (error) {
      this.handleError('findDevices', error as Error, { filters });
    }
  }

  /**
   * ID로 장비 조회
   */
  async findDeviceById(id: string): Promise<DeviceWithGroup | null> {
    try {
      const cacheKey = this.getCacheKey(id);
      
      // 캐시 조회
      const cached = await this.getFromCache<DeviceWithGroup>(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for device: ${id}`);
        return cached;
      }

      // 데이터베이스 조회
      const device = await this.prisma.device.findUnique({
        where: { id },
        include: {
          group: {
            select: {
              id: true,
              name: true,
              description: true,
              parentId: true
            }
          }
        }
      });

      if (device) {
        // 캐시 저장
        await this.setToCache(cacheKey, device);
        this.logger.debug(`Device found and cached: ${id}`);
      }

      return device as DeviceWithGroup | null;

    } catch (error) {
      this.handleError('findDeviceById', error as Error, { id });
    }
  }

  /**
   * 장비 생성
   */
  async createDevice(data: DeviceCreateInput): Promise<Device> {
    try {
      // 트랜잭션으로 생성
      const device = await this.executeInTransaction(async (tx) => {
        // 중복 이름 체크
        const existing = await tx.device.findUnique({
          where: { name: data.name }
        });

        if (existing) {
          throw new Error(`Device with name '${data.name}' already exists`);
        }

        // 그룹 존재 확인 (그룹이 지정된 경우)
        if (data.groupId) {
          const group = await tx.deviceGroup.findUnique({
            where: { id: data.groupId }
          });

          if (!group) {
            throw new Error(`Device group with ID '${data.groupId}' not found`);
          }
        }

        // 장비 생성
        return await tx.device.create({
          data: {
            name: data.name,
            type: data.type,
            status: data.status || 'active',
            groupId: data.groupId,
            metadata: data.metadata || {},
            tags: data.tags || []
          }
        });
      });

      // 캐시 무효화
      await this.invalidateCache('list');
      
      this.logger.info(`Device created successfully: ${device.id} (${device.name})`);
      return device;

    } catch (error) {
      this.handleError('createDevice', error as Error, { data });
    }
  }

  /**
   * WHERE 조건 구성 (장비 전용)
   */
  private buildDeviceWhereClause(filters: DeviceFilter): any {
    const where: any = {};

    // 기본 필터
    if (filters.id) {
      where.id = filters.id;
    }

    if (filters.name) {
      where.name = { contains: filters.name, mode: 'insensitive' };
    }

    if (filters.type) {
      if (Array.isArray(filters.type)) {
        where.type = { in: filters.type };
      } else {
        where.type = filters.type;
      }
    }

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        where.status = { in: filters.status };
      } else {
        where.status = filters.status;
      }
    }

    if (filters.groupId) {
      where.groupId = filters.groupId;
    }

    // 태그 필터
    if (filters.tags && filters.tags.length > 0) {
      where.tags = {
        hasEvery: filters.tags
      };
    }

    // 검색 (이름 또는 메타데이터)
    if (filters.search) {
      where.OR = [
        {
          name: {
            contains: filters.search,
            mode: 'insensitive'
          }
        },
        {
          metadata: {
            path: [],
            string_contains: filters.search
          }
        }
      ];
    }

    return where;
  }
}
