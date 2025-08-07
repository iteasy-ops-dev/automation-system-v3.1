/**
 * Storage Service - Prisma 기반 완전 재구현
 * crypto 문제 해결
 */

import { PrismaClient } from '@prisma/client';
import { DeviceRepository } from '../repositories/device.repository';
import { CacheService } from './cache.service';
import { EventBusService } from './event-bus.service';
import { Logger } from '../utils/logger';
import { randomUUID } from 'crypto';
import { 
  DeviceFilter, 
  DeviceListResponse, 
  DeviceCreate, 
  DeviceUpdate,
  StorageStats,
  HealthCheckResult
} from '../types/storage.types';

export class StorageService {
  private readonly logger: Logger = new Logger('StorageService');
  private readonly deviceRepository: DeviceRepository;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly cacheService: CacheService,
    private readonly eventBusService: EventBusService | null
  ) {
    this.deviceRepository = new DeviceRepository(prisma, cacheService);
    this.logger.info('StorageService initialized with Prisma');
  }

  async getDevices(filters: DeviceFilter): Promise<DeviceListResponse> {
    try {
      this.logger.debug('Getting devices', { filters });
      const result = await this.deviceRepository.findDevices(filters);
      this.logger.info('Devices retrieved successfully', { 
        total: result.total,
        returned: result.items.length 
      });
      return result;
    } catch (error) {
      this.logger.error('Error getting devices', { error, filters });
      throw this.handleServiceError(error, 'getDevices');
    }
  }

  async getDevice(id: string) {
    try {
      this.logger.debug('Getting device', { id });
      const device = await this.deviceRepository.findById(id);
      if (!device) {
        throw new Error('Device not found');
      }
      this.logger.info('Device retrieved successfully', { 
        deviceId: device.id,
        name: device.name 
      });
      return device;
    } catch (error) {
      this.logger.error('Error getting device', { error, id });
      throw this.handleServiceError(error, 'getDevice');
    }
  }

  async createDevice(data: DeviceCreate) {
    try {
      this.logger.debug('Creating device', { data });
      const device = await this.deviceRepository.create(data);
      
      if (this.eventBusService) {
        await this.eventBusService.publishEvent('device-events', {
        eventId: randomUUID(),
        eventType: 'DeviceCreated',
        timestamp: new Date().toISOString(),
        deviceId: device.id,
        payload: {
          device: {
            name: device.name,
            type: device.type,
            groupId: device.groupId
          }
        },
        metadata: {
          source: 'storage-service'
        }
      });
      }
      
      this.logger.info('Device created successfully', { 
        deviceId: device.id,
        name: device.name 
      });
      return device;
    } catch (error) {
      this.logger.error('Error creating device', { error, data });
      throw this.handleServiceError(error, 'createDevice');
    }
  }

  async updateDevice(id: string, data: DeviceUpdate) {
    try {
      this.logger.debug('Updating device', { id, data });
      const device = await this.deviceRepository.update(id, data);
      
      if (this.eventBusService) {
        await this.eventBusService.publishEvent('device-events', {
          eventId: randomUUID(),
          eventType: 'DeviceUpdated',
          timestamp: new Date().toISOString(),
          deviceId: device.id,
          payload: {
            device: {
              name: device.name,
              type: device.type,
              groupId: device.groupId
            }
          },
          metadata: {
            source: 'storage-service'
          }
        });
      }
      
      this.logger.info('Device updated successfully', { 
        deviceId: device.id,
        name: device.name 
      });
      return device;
    } catch (error) {
      this.logger.error('Error updating device', { error, id, data });
      throw this.handleServiceError(error, 'updateDevice');
    }
  }

  async deleteDevice(id: string): Promise<void> {
    try {
      this.logger.debug('Deleting device', { id });
      const device = await this.deviceRepository.findById(id);
      if (!device) {
        throw new Error('Device not found');
      }
      
      await this.deviceRepository.delete(id);
      
      if (this.eventBusService) {
        await this.eventBusService.publishEvent('device-events', {
          eventId: randomUUID(),
          eventType: 'DeviceDeleted',
          timestamp: new Date().toISOString(),
          deviceId: id,
          payload: {
            device: {
              name: device.name,
              type: device.type,
              groupId: device.groupId
            }
          },
          metadata: {
            source: 'storage-service'
          }
        });
      }
      
      this.logger.info('Device deleted successfully', { deviceId: id });
    } catch (error) {
      this.logger.error('Error deleting device', { error, id });
      throw this.handleServiceError(error, 'deleteDevice');
    }
  }

  async getDevicesByGroup(groupId: string) {
    try {
      this.logger.debug('Getting devices by group', { groupId });
      const devices = await this.deviceRepository.findByGroupId(groupId);
      this.logger.info('Devices by group retrieved successfully', { 
        groupId,
        count: devices.length 
      });
      return devices;
    } catch (error) {
      this.logger.error('Error getting devices by group', { error, groupId });
      throw this.handleServiceError(error, 'getDevicesByGroup');
    }
  }

  async getDecryptedConnectionInfo(id: string) {
    try {
      this.logger.debug('Getting decrypted connection info', { id });
      const device = await this.deviceRepository.findById(id);
      if (!device) {
        throw new Error('Device not found');
      }
      
      const connectionInfo = await this.deviceRepository.getDecryptedConnectionInfo(id);
      
      this.logger.info('Connection info retrieved successfully', { 
        deviceId: id,
        protocol: connectionInfo.protocol 
      });
      
      return connectionInfo;
    } catch (error) {
      this.logger.error('Error getting decrypted connection info', { error, id });
      throw this.handleServiceError(error, 'getDecryptedConnectionInfo');
    }
  }

  async flushCache(): Promise<void> {
    try {
      this.logger.debug('Flushing cache');
      await this.cacheService.flushAll();
      this.logger.info('Cache flushed successfully');
    } catch (error) {
      this.logger.error('Error flushing cache', error);
      throw this.handleServiceError(error, 'flushCache');
    }
  }

  async getCacheStats() {
    try {
      this.logger.debug('Getting cache stats');
      const stats = await this.cacheService.getStats();
      this.logger.debug('Cache stats retrieved', { stats });
      return stats;
    } catch (error) {
      this.logger.error('Error getting cache stats', error);
      throw this.handleServiceError(error, 'getCacheStats');
    }
  }

  async getSystemStats(): Promise<StorageStats> {
    try {
      this.logger.debug('Getting system stats');
      
      const [deviceCount, cacheStats] = await Promise.all([
        this.prisma.device.count(),
        this.cacheService.getStats()
      ]);
      
      const stats: StorageStats = {
        devices: {
          total: deviceCount,
          byStatus: await this.getDeviceCountsByStatus(),
          byType: await this.getDeviceCountsByType()
        },
        cache: cacheStats,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      };
      
      this.logger.debug('System stats computed', { stats });
      return stats;
    } catch (error) {
      this.logger.error('Error getting system stats', error);
      throw this.handleServiceError(error, 'getSystemStats');
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    try {
      this.logger.debug('Performing health check');
      
      const checks = await Promise.allSettled([
        this.checkDatabaseHealth(),
        this.checkCacheHealth(),
        this.checkEventBusHealth()
      ]);
      
      const [database, cache, eventBus] = checks.map(result => 
        result.status === 'fulfilled' ? result.value : false
      );
      
      const healthy = database && cache && eventBus;
      
      const result: HealthCheckResult = {
        healthy,
        checks: {
          database,
          cache,
          eventBus
        },
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      };
      
      this.logger.info('Health check completed', { result });
      return result;
    } catch (error) {
      this.logger.error('Error during health check', error);
      throw this.handleServiceError(error, 'healthCheck');
    }
  }

  private async checkDatabaseHealth(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.warn('Database health check failed', error);
      return false;
    }
  }

  private async checkCacheHealth(): Promise<boolean> {
    try {
      return await this.cacheService.ping();
    } catch (error) {
      this.logger.warn('Cache health check failed', error);
      return false;
    }
  }

  private async checkEventBusHealth(): Promise<boolean> {
    try {
      if (!this.eventBusService) return false;
      return await this.eventBusService.isHealthy();
    } catch (error) {
      this.logger.warn('Event bus health check failed', error);
      return false;
    }
  }

  private async getDeviceCountsByStatus() {
    const result = await this.prisma.device.groupBy({
      by: ['status'],
      _count: true
    });
    
    return result.reduce((acc, item) => {
      acc[item.status] = item._count;
      return acc;
    }, {} as Record<string, number>);
  }

  private async getDeviceCountsByType() {
    const result = await this.prisma.device.groupBy({
      by: ['type'],
      _count: true
    });
    
    return result.reduce((acc, item) => {
      acc[item.type] = item._count;
      return acc;
    }, {} as Record<string, number>);
  }

  private handleServiceError(error: unknown, operation: string): Error {
    if (error instanceof Error) {
      return error;
    }
    return new Error(`Unknown error in ${operation}: ${String(error)}`);
  }
}
