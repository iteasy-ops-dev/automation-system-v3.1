/**
 * Storage Service - Prisma 기반 통합 데이터 관리
 * 계약 준수: shared/contracts/v1.0/rest/core/storage-api.yaml 100% 일치
 * 아키텍처: v3.1 Storage Service 명세 구현
 */

import { PrismaClient, Device, DeviceGroup } from '@prisma/client';
import { DeviceRepository, DeviceFilter, DeviceListResponse, DeviceCreateData, DeviceUpdateData } from '../repositories/device.repository';
import { CacheService } from './cache.service';
import { Logger } from '../utils/logger';

// ========================================
// Event 인터페이스 (Kafka 이벤트용)
// ========================================

export interface DeviceEvent {
  eventId: string;
  eventType: 'DeviceCreated' | 'DeviceUpdated' | 'DeviceDeleted' | 'DeviceStatusChanged';
  timestamp: string;
  deviceId: string;
  payload: any;
  metadata?: {
    userId?: string;
    correlationId?: string;
    source: string;
  };
}

// ========================================
// Service 메인 클래스
// ========================================

export class StorageService {
  private deviceRepository: DeviceRepository;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly cache: CacheService,
    private readonly logger: Logger
  ) {
    // Prisma 기반 Repository 초기화
    this.deviceRepository = new DeviceRepository(prisma, cache, logger);
    
    this.logger.info('StorageService initialized with Prisma');
  }

  // ========================================
  // Device Management (계약 100% 준수)
  // ========================================

  /**
   * GET /storage/devices - 장비 목록 조회
   * 계약: DeviceListResponse 반환
   */
  async getDevices(filters: DeviceFilter): Promise<DeviceListResponse> {
    this.logger.debug('Getting devices', { filters });
    
    try {
      const result = await this.deviceRepository.findDevices(filters);
      
      this.logger.info('Devices retrieved successfully', { 
        total: result.total, 
        count: result.items.length 
      });
      
      return result;
    } catch (error) {
      this.logger.error('Failed to get devices', { filters, error: error.message });
      throw this.handleError('getDevices', error);
    }
  }

  /**
   * GET /storage/devices/{id} - 장비 상세 조회
   * 계약: Device 반환 또는 null (404)
   */
  async getDeviceById(id: string): Promise<Device | null> {
    this.logger.debug('Getting device by ID', { id });
    
    try {
      const device = await this.deviceRepository.findDeviceById(id);
      
      if (device) {
        this.logger.debug('Device found', { id, name: device.name });
      } else {
        this.logger.warn('Device not found', { id });
      }
      
      return device;
    } catch (error) {
      this.logger.error('Failed to get device by ID', { id, error: error.message });
      throw this.handleError('getDeviceById', error);
    }
  }

  /**
   * POST /storage/devices - 장비 등록
   * 계약: Device 반환, 중복시 409 에러
   */
  async createDevice(data: DeviceCreateData, userId?: string): Promise<Device> {
    this.logger.debug('Creating device', { data, userId });
    
    try {
      const device = await this.deviceRepository.createDevice(data);
      
      // 이벤트 발행 (비동기)
      setImmediate(() => {
        this.publishDeviceEvent('DeviceCreated', device, { userId });
      });
      
      this.logger.info('Device created successfully', { 
        id: device.id, 
        name: device.name,
        userId 
      });
      
      return device;
    } catch (error) {
      this.logger.error('Failed to create device', { data, userId, error: error.message });
      throw this.handleError('createDevice', error);
    }
  }

  /**
   * PUT /storage/devices/{id} - 장비 정보 수정
   * 계약: Device 반환 또는 null (404)
   */
  async updateDevice(id: string, data: DeviceUpdateData, userId?: string): Promise<Device | null> {
    this.logger.debug('Updating device', { id, data, userId });
    
    try {
      const device = await this.deviceRepository.updateDevice(id, data);
      
      if (device) {
        // 이벤트 발행 (비동기)
        setImmediate(() => {
          this.publishDeviceEvent('DeviceUpdated', device, { userId });
        });
        
        this.logger.info('Device updated successfully', { 
          id, 
          changes: Object.keys(data),
          userId 
        });
      } else {
        this.logger.warn('Device not found for update', { id, userId });
      }
      
      return device;
    } catch (error) {
      this.logger.error('Failed to update device', { id, data, userId, error: error.message });
      throw this.handleError('updateDevice', error);
    }
  }

  /**
   * DELETE /storage/devices/{id} - 장비 삭제
   * 계약: boolean 반환
   */
  async deleteDevice(id: string, userId?: string): Promise<boolean> {
    this.logger.debug('Deleting device', { id, userId });
    
    try {
      // 삭제 전 장비 정보 조회 (이벤트용)
      const device = await this.deviceRepository.findDeviceById(id);
      
      const deleted = await this.deviceRepository.deleteDevice(id);
      
      if (deleted && device) {
        // 이벤트 발행 (비동기)
        setImmediate(() => {
          this.publishDeviceEvent('DeviceDeleted', device, { userId });
        });
        
        this.logger.info('Device deleted successfully', { 
          id, 
          name: device.name,
          userId 
        });
      } else {
        this.logger.warn('Device not found for deletion', { id, userId });
      }
      
      return deleted;
    } catch (error) {
      this.logger.error('Failed to delete device', { id, userId, error: error.message });
      throw this.handleError('deleteDevice', error);
    }
  }

  // ========================================
  // Device Group Management
  // ========================================

  /**
   * GET /storage/device-groups - 그룹 목록 조회
   */
  async getDeviceGroups(filters: { parentId?: string; limit?: number; offset?: number }) {
    this.logger.debug('Getting device groups', { filters });
    
    try {
      const result = await this.deviceRepository.findDeviceGroups(filters);
      
      this.logger.info('Device groups retrieved successfully', { 
        total: result.total, 
        count: result.items.length 
      });
      
      return result;
    } catch (error) {
      this.logger.error('Failed to get device groups', { filters, error: error.message });
      throw this.handleError('getDeviceGroups', error);
    }
  }

  /**
   * POST /storage/device-groups - 그룹 생성
   */
  async createDeviceGroup(data: {
    name: string;
    description?: string;
    parentId?: string;
    metadata?: Record<string, any>;
  }, userId?: string): Promise<DeviceGroup> {
    this.logger.debug('Creating device group', { data, userId });
    
    try {
      const group = await this.deviceRepository.createDeviceGroup(data);
      
      this.logger.info('Device group created successfully', { 
        id: group.id, 
        name: group.name,
        userId 
      });
      
      return group;
    } catch (error) {
      this.logger.error('Failed to create device group', { data, userId, error: error.message });
      throw this.handleError('createDeviceGroup', error);
    }
  }

  // ========================================
  // Statistics and Health
  // ========================================

  /**
   * 장비 통계 조회
   */
  async getDeviceStats() {
    this.logger.debug('Getting device statistics');
    
    try {
      const stats = await this.deviceRepository.getDeviceStats();
      
      this.logger.debug('Device statistics retrieved', { stats });
      
      return stats;
    } catch (error) {
      this.logger.error('Failed to get device statistics', { error: error.message });
      throw this.handleError('getDeviceStats', error);
    }
  }

  /**
   * 서비스 헬스체크
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    services: {
      database: boolean;
      cache: boolean;
      repository: boolean;
    };
    timestamp: string;
  }> {
    const timestamp = new Date().toISOString();
    
    try {
      // 데이터베이스 연결 확인
      const dbHealthy = await this.deviceRepository.healthCheck();
      
      // 캐시 연결 확인
      const cacheHealthy = await this.cache.healthCheck();
      
      // Repository 기능 확인
      const repoHealthy = dbHealthy; // Repository는 DB에 의존
      
      const allHealthy = dbHealthy && cacheHealthy && repoHealthy;
      
      const result = {
        status: allHealthy ? 'healthy' as const : 'unhealthy' as const,
        services: {
          database: dbHealthy,
          cache: cacheHealthy,
          repository: repoHealthy
        },
        timestamp
      };
      
      this.logger.info('Health check completed', result);
      
      return result;
    } catch (error) {
      this.logger.error('Health check failed', { error: error.message });
      
      return {
        status: 'unhealthy',
        services: {
          database: false,
          cache: false,
          repository: false
        },
        timestamp
      };
    }
  }

  // ========================================
  // Event Publishing (비동기)
  // ========================================

  /**
   * Device 이벤트 발행
   */
  private publishDeviceEvent(
    eventType: DeviceEvent['eventType'],
    device: Device,
    metadata?: { userId?: string; correlationId?: string }
  ): void {
    try {
      const event: DeviceEvent = {
        eventId: crypto.randomUUID(),
        eventType,
        timestamp: new Date().toISOString(),
        deviceId: device.id,
        payload: {
          device: {
            id: device.id,
            name: device.name,
            type: device.type,
            status: device.status,
            groupId: device.groupId
          }
        },
        metadata: {
          ...metadata,
          source: 'storage-service'
        }
      };

      // 실제 구현에서는 Kafka 등의 이벤트 버스로 발행
      this.logger.info('Device event published', { 
        eventType, 
        deviceId: device.id,
        eventId: event.eventId 
      });
      
      // TODO: Kafka 이벤트 발행 구현
      // await this.eventBus.publish('device-events', event);
      
    } catch (error) {
      this.logger.error('Failed to publish device event', { 
        eventType, 
        deviceId: device.id, 
        error: error.message 
      });
    }
  }

  // ========================================
  // Error Handling
  // ========================================

  /**
   * 에러 처리 및 변환
   */
  private handleError(operation: string, error: any): Error {
    // Repository 에러 전파
    if (error.name && error.name.includes('_')) {
      return error;
    }

    // 일반 에러 래핑
    const wrappedError = new Error(`${operation} failed: ${error.message}`);
    wrappedError.name = 'STORAGE_SERVICE_ERROR';
    return wrappedError;
  }

  // ========================================
  // Cleanup
  // ========================================

  /**
   * 서비스 정리
   */
  async shutdown(): Promise<void> {
    try {
      this.logger.info('Shutting down StorageService');
      
      await this.prisma.$disconnect();
      
      this.logger.info('StorageService shutdown completed');
    } catch (error) {
      this.logger.error('Failed to shutdown StorageService', { error: error.message });
    }
  }
}
