/**
 * Prisma 기반 Device Repository - connectionInfo 암호화 지원
 * shared/contracts/v1.0/rest/core/storage-api.yaml 계약 100% 준수
 * BACKEND-FIX: ConnectionInfo 완전 지원
 */

import { PrismaClient, Device, DeviceGroup, Prisma } from '@prisma/client';
import { CacheService } from '../services/cache.service';
import { encryptionService } from '../services/encryption.service';
import { Logger } from '../utils/logger';
import { 
  DeviceFilter, 
  DeviceListResponse, 
  DeviceCreate, 
  DeviceUpdate,
  PaginatedResult 
} from '../types/storage.types';

export class DeviceRepository {
  private readonly logger: Logger = new Logger('DeviceRepository');
  private readonly cachePrefix = 'device';
  private readonly cacheTTL = 30; // 30초

  constructor(
    private readonly prisma: PrismaClient,
    private readonly cache: CacheService
  ) {}

  /**
   * Storage API 계약용 findDevices 메서드
   * GET /api/v1/storage/devices 지원
   */
  async findDevices(filters: DeviceFilter): Promise<DeviceListResponse> {
    try {
      // 캐시 키 생성
      const cacheKey = this.getListCacheKey(filters);
      this.logger.debug('Attempting cache lookup', { filters, cacheKey });
      
      const cached = await this.cache.get<DeviceListResponse>(cacheKey);
      
      if (cached) {
        this.logger.debug('Device list cache hit', { 
          filters, 
          cacheKey,
          total: cached.total
        });
        
        // 캐시된 데이터 검증
        if (cached && typeof cached === 'object' && 'items' in cached && 'total' in cached) {
          return cached;
        } else {
          this.logger.error('Invalid cached data structure', { cached });
          await this.cache.del(cacheKey);
        }
      }

      this.logger.debug('Device list cache miss, querying database', { filters, cacheKey });

      // Prisma 쿼리 조건 구성
      const where = this.buildWhereClause(filters);
      const orderBy = this.buildOrderBy(filters);
      
      const [items, total] = await Promise.all([
        this.prisma.device.findMany({
          where,
          orderBy,
          skip: filters.offset || 0,
          take: filters.limit || 20,
          include: { 
            group: true,
            statusHistory: {
              take: 1,
              orderBy: { changedAt: 'desc' }
            }
          }
        }),
        this.prisma.device.count({ where })
      ]);

      // connectionInfo 마스킹 처리
      const maskedItems = this.maskDevicesConnectionInfo(items);

      const result: DeviceListResponse = {
        items: maskedItems,
        total,
        limit: filters.limit || 20,
        offset: filters.offset || 0
      };

      // 캐시 저장
      await this.cache.set(cacheKey, result, this.cacheTTL);
      this.logger.debug('Device list cached', { total, cacheKey });

      return result;
    } catch (error) {
      this.logger.error('Error finding devices', { error: error.message, filters });
      throw this.handleDatabaseError(error, 'findDevices');
    }
  }

  /**
   * 단일 Device 조회
   */
  async findById(id: string): Promise<Device | null> {
    try {
      const cacheKey = `${this.cachePrefix}:${id}`;
      const cached = await this.cache.get<Device>(cacheKey);
      
      if (cached) {
        this.logger.debug('Device cache hit', { id, cacheKey });
        return this.maskDeviceConnectionInfo(cached);
      }

      const device = await this.prisma.device.findUnique({
        where: { id },
        include: { 
          group: true,
          statusHistory: {
            take: 5,
            orderBy: { changedAt: 'desc' }
          }
        }
      });

      if (device) {
        await this.cache.set(cacheKey, device, this.cacheTTL);
        this.logger.debug('Device cached', { id, cacheKey });
        return this.maskDeviceConnectionInfo(device);
      }

      return null;
    } catch (error) {
      this.logger.error('Error finding device by ID', { error: error.message, id });
      throw this.handleDatabaseError(error, 'findById');
    }
  }

  /**
   * Device 생성
   */
  async create(data: DeviceCreate): Promise<Device> {
    try {
      // connectionInfo 암호화 처리 (보안 강화)
      let encryptedConnectionInfo = undefined;
      if (data.connectionInfo) {
        encryptedConnectionInfo = encryptionService.encryptConnectionInfo(data.connectionInfo);
        this.logger.debug('ConnectionInfo encrypted for device creation', { 
          deviceName: data.name,
          protocol: data.connectionInfo.protocol,
          host: data.connectionInfo.host
        });
      }

      const device = await this.prisma.device.create({
        data: {
          name: data.name,
          type: data.type,
          group: data.groupId ? {
            connect: { id: data.groupId }
          } : undefined,
          connectionInfo: encryptedConnectionInfo,  // 암호화된 연결 정보 저장
          metadata: data.metadata || {},
          tags: data.tags || [],
          status: data.status || 'active'
        },
        include: { 
          group: true,
          statusHistory: true
        }
      });

      // 캐시 무효화
      await this.invalidateListCache();
      
      this.logger.info('Device created successfully', { 
        deviceId: device.id, 
        name: device.name
      });

      // 응답에서 connectionInfo 마스킹 처리
      return this.maskDeviceConnectionInfo(device);
    } catch (error) {
      this.logger.error('Error creating device', { error: error.message, data });
      throw this.handleDatabaseError(error, 'create');
    }
  }

  /**
   * Device 업데이트 - connectionInfo 암호화 지원
   */
  async update(id: string, data: DeviceUpdate): Promise<Device> {
    try {
      // connectionInfo 암호화 처리
      let encryptedConnectionInfo = undefined;
      if (data.connectionInfo) {
        encryptedConnectionInfo = encryptionService.encryptConnectionInfo(data.connectionInfo);
        this.logger.debug('ConnectionInfo encrypted for device update', { 
          deviceId: id,
          protocol: data.connectionInfo.protocol,
          host: data.connectionInfo.host
        });
      }

      const updateData: any = {
        updatedAt: new Date()
      };

      // 필드별로 명시적 할당
      if (data.name !== undefined) updateData.name = data.name;
      if (data.type !== undefined) updateData.type = data.type;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.groupId !== undefined) {
        updateData.group = data.groupId ? {
          connect: { id: data.groupId }
        } : {
          disconnect: true
        };
      }
      if (data.metadata !== undefined) updateData.metadata = data.metadata;
      if (data.tags !== undefined) updateData.tags = data.tags;
      if (encryptedConnectionInfo !== undefined) updateData.connectionInfo = encryptedConnectionInfo; // connectionInfo 업데이트 추가

      const device = await this.prisma.device.update({
        where: { id },
        data: updateData,
        include: { 
          group: true,
          statusHistory: {
            take: 5,
            orderBy: { changedAt: 'desc' }
          }
        }
      });

      // 캐시 무효화
      await this.cache.del(`${this.cachePrefix}:${id}`);
      await this.invalidateListCache();

      this.logger.info('Device updated successfully', { 
        deviceId: device.id, 
        name: device.name,
        hasConnectionInfo: !!data.connectionInfo
      });

      // 응답에서 connectionInfo 마스킹 처리
      return this.maskDeviceConnectionInfo(device);
    } catch (error) {
      this.logger.error('Error updating device', { error: error.message, id, data });
      throw this.handleDatabaseError(error, 'update');
    }
  }

  /**
   * Device 삭제
   */
  async delete(id: string): Promise<void> {
    try {
      await this.prisma.device.delete({
        where: { id }
      });

      // 캐시 무효화
      await this.cache.del(`${this.cachePrefix}:${id}`);
      await this.invalidateListCache();

      this.logger.info('Device deleted', { deviceId: id });
    } catch (error) {
      this.logger.error('Error deleting device', { error: error.message, id });
      throw this.handleDatabaseError(error, 'delete');
    }
  }

  /**
   * 그룹별 Device 조회
   */
  async findByGroupId(groupId: string): Promise<Device[]> {
    try {
      const cacheKey = `${this.cachePrefix}:group:${groupId}`;
      const cached = await this.cache.get<Device[]>(cacheKey);
      
      if (cached) {
        return this.maskDevicesConnectionInfo(cached);
      }

      const devices = await this.prisma.device.findMany({
        where: { groupId },
        include: { group: true },
        orderBy: { name: 'asc' }
      });

      await this.cache.set(cacheKey, devices, this.cacheTTL);
      return this.maskDevicesConnectionInfo(devices);
    } catch (error) {
      this.logger.error('Error finding devices by group', { error: error.message, groupId });
      throw this.handleDatabaseError(error, 'findByGroupId');
    }
  }

  /**
   * connectionInfo 복호화 (실제 연결 시에만 사용)
   */
  async getDecryptedConnectionInfo(deviceId: string): Promise<any> {
    try {
      const device = await this.prisma.device.findUnique({
        where: { id: deviceId },
        select: { connectionInfo: true }
      });

      if (!device?.connectionInfo) {
        return null;
      }

      return encryptionService.decryptConnectionInfo(device.connectionInfo);
    } catch (error) {
      this.logger.error('Error decrypting connection info', { deviceId, error: error.message });
      throw new Error('Failed to decrypt connection information');
    }
  }

  /**
   * WHERE 절 구성
   */
  private buildWhereClause(filters: DeviceFilter): Prisma.DeviceWhereInput {
    const where: Prisma.DeviceWhereInput = {};

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
        { name: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    if (filters.tags && filters.tags.length > 0) {
      where.tags = {
        hasEvery: filters.tags
      };
    }

    return where;
  }

  /**
   * ORDER BY 절 구성
   */
  private buildOrderBy(filters: DeviceFilter): Prisma.DeviceOrderByWithRelationInput {
    const sortField = filters.sortBy || 'name';
    const sortOrder = filters.sortOrder || 'asc';

    const orderBy: Prisma.DeviceOrderByWithRelationInput = {};
    orderBy[sortField as keyof Prisma.DeviceOrderByWithRelationInput] = sortOrder;

    return orderBy;
  }

  /**
   * 캐시 키 생성
   */
  private getListCacheKey(filters: DeviceFilter): string {
    const parts = [
      this.cachePrefix,
      'list',
      filters.groupId || 'all',
      filters.status || 'all',
      filters.type || 'all',
      filters.search || 'nosearch',
      filters.tags?.join('-') || 'notags',
      filters.limit || 20,
      filters.offset || 0,
      filters.sortBy || 'name',
      filters.sortOrder || 'asc'
    ];

    return parts.join(':');
  }

  /**
   * 목록 캐시 무효화
   */
  private async invalidateListCache(): Promise<void> {
    try {
      await this.cache.delPattern(`${this.cachePrefix}:list:*`);
      this.logger.debug('List cache invalidated');
    } catch (error) {
      this.logger.error('Error invalidating list cache', { error: error.message });
    }
  }

  /**
   * Device의 connectionInfo를 마스킹 처리 (보안 강화)
   */
  private maskDeviceConnectionInfo(device: any): any {
    if (device && device.connectionInfo) {
      // connectionInfo 복호화 및 민감 정보 마스킹
      try {
        const decryptedInfo = encryptionService.decryptConnectionInfo(device.connectionInfo);
        device.connectionInfo = {
          ...decryptedInfo,
          password: decryptedInfo.password ? '****' : undefined,
          privateKey: decryptedInfo.privateKey ? '****' : undefined,
          sudoPassword: decryptedInfo.sudoPassword ? '****' : undefined
        };
      } catch (error) {
        this.logger.warn('Failed to decrypt connectionInfo for masking', { 
          deviceId: device.id,
          error: error.message 
        });
        // 복호화 실패 시 전체 마스킹
        device.connectionInfo = { protocol: '****', host: '****', port: 0 };
      }
    }
    return device;
  }

  /**
   * Device 배열의 connectionInfo를 마스킹 처리 (보안 강화)
   */
  private maskDevicesConnectionInfo(devices: any[]): any[] {
    return devices.map(device => this.maskDeviceConnectionInfo(device));
  }

  /**
   * 데이터베이스 에러 처리
   */
  private handleDatabaseError(error: any, operation: string): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      switch (error.code) {
        case 'P2002':
          return new Error(`Device with this ${error.meta?.target} already exists`);
        case 'P2025':
          return new Error('Device not found');
        default:
          this.logger.error(`Prisma error in ${operation}`, { 
            code: error.code, 
            meta: error.meta 
          });
          return new Error(`Database error in ${operation}`);
      }
    }

    this.logger.error(`Unexpected error in ${operation}`, { error: error.message });
    return error instanceof Error ? error : new Error(`Unknown error in ${operation}`);
  }
}
