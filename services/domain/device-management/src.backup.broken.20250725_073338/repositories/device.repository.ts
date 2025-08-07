/**
 * Device Repository - Simplified for DeviceManagementService
 * @file src/repositories/device.repository.ts
 */

import { PrismaClient } from '@prisma/client';
import { CacheService } from '../services/cache.service';
import { Logger } from '../utils/logger';

export interface Device {
  id: string;
  name: string;
  type: string;
  status: string;
  groupId?: string;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
  group?: any;
}

export class DeviceRepository {
  private prisma: PrismaClient;
  private cache: CacheService;
  private logger: Logger;
  protected readonly cachePrefix = 'device';

  constructor(prisma: PrismaClient, cache: CacheService) {
    this.prisma = prisma;
    this.cache = cache;
    this.logger = new Logger();
  }

  /**
   * ID로 장비 조회
   */
  async findById(id: string): Promise<Device | null> {
    try {
      const cacheKey = `${this.cachePrefix}:${id}`;
      
      // 캐시에서 조회 시도
      const cached = await this.cache.get<Device>(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for device: ${id}`);
        return cached;
      }

      // DB에서 조회
      const device = await this.prisma.device.findUnique({
        where: { id },
        include: {
          group: true
        }
      });

      if (device) {
        // 캐시에 저장
        await this.cache.set(cacheKey, device, 300);
        this.logger.debug(`Device found and cached: ${id}`);
      }

      return device;
    } catch (error) {
      this.logger.error('Failed to find device by ID:', { id, error });
      return null;
    }
  }

  /**
   * 장비 목록 조회
   */
  async findMany(options: {
    where?: any;
    select?: any;
    include?: any;
    orderBy?: any;
    take?: number;
    skip?: number;
  }): Promise<Device[]> {
    try {
      const devices = await this.prisma.device.findMany(options);
      this.logger.debug(`Found ${devices.length} devices`);
      return devices;
    } catch (error) {
      this.logger.error('Failed to find devices:', { options, error });
      return [];
    }
  }

  /**
   * 장비 업데이트
   */
  async update(id: string, data: any): Promise<Device | null> {
    try {
      const updatedDevice = await this.prisma.device.update({
        where: { id },
        data,
        include: {
          group: true
        }
      });

      // 캐시 무효화
      const cacheKey = `${this.cachePrefix}:${id}`;
      await this.cache.del(cacheKey);

      this.logger.debug(`Device updated: ${id}`);
      return updatedDevice;
    } catch (error) {
      this.logger.error('Failed to update device:', { id, data, error });
      return null;
    }
  }
}
