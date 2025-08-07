/**
 * Storage Service 클라이언트 - Device Management Service
 * v3.1 아키텍처 핵심: 모든 PostgreSQL 데이터 접근은 Storage API를 통해서만
 * Storage Service (포트 8001) REST API 클라이언트
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import * as http from 'http';
import * as https from 'https';
import { 
  Device, 
  DeviceGroup, 
  DeviceListResponse,
  DeviceGroupListResponse,
  StorageDeviceFilter,
  StorageDeviceCreateRequest,
  StorageDeviceListResponse,
  DeviceConnectionInfo
} from '../types';
import { Logger } from '../utils/logger';

export class StorageClientService {
  private client: AxiosInstance;
  private logger: Logger;

  constructor(storageServiceUrl: string) {
    this.logger = new Logger('StorageClient');
    
    this.client = axios.create({
      baseURL: storageServiceUrl,  // http://localhost:8001 또는 http://storage:8001
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'device-management-service/1.0.0'
      },
      // IPv4 강제
      httpAgent: new http.Agent({ family: 4 }),
      httpsAgent: new https.Agent({ family: 4 })
    });

    // 요청/응답 로깅
    this.client.interceptors.request.use((config) => {
      this.logger.debug('Storage API Request', {
        method: config.method?.toUpperCase(),
        url: config.url,
        params: config.params
      });
      return config;
    });

    this.client.interceptors.response.use(
      (response) => {
        this.logger.debug('Storage API Response', {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        this.logger.error('Storage API Error', error, {
          url: error.config?.url,
          status: error.response?.status,
          message: error.response?.data?.error?.message
        });
        throw error;
      }
    );
  }

  /**
   * 헬스 체크 - Storage Service 연결 확인
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch (error) {
      this.logger.error('Storage Service health check failed', error);
      return false;
    }
  }

  // ============ Device CRUD Operations ============

  /**
   * 장비 목록 조회 (Storage API 경유)
   * GET /api/v1/storage/devices
   */
  async getDevices(filters: StorageDeviceFilter): Promise<StorageDeviceListResponse> {
    try {
      const response: AxiosResponse<StorageDeviceListResponse> = await this.client.get(
        '/api/v1/storage/devices',
        { params: filters }
      );

      this.logger.info('Devices retrieved from Storage API', {
        count: response.data.items.length,
        total: response.data.total,
        filters
      });

      return response.data;
    } catch (error: any) {
      this.logger.error('Failed to get devices from Storage API', error, { filters });
      throw new Error(`Storage API error: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * 장비 상세 조회 (Storage API 경유)
   * GET /api/v1/storage/devices/{id}
   */
  async getDeviceById(id: string): Promise<Device> {
    try {
      const response: AxiosResponse<Device> = await this.client.get(
        `/api/v1/storage/devices/${id}`
      );

      this.logger.info('Device retrieved from Storage API', {
        deviceId: id,
        deviceName: response.data.name
      });

      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error(`Device not found: ${id}`);
      }
      this.logger.error('Failed to get device from Storage API', error, { deviceId: id });
      throw new Error(`Storage API error: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * 장비 등록 (Storage API 경유)
   * POST /api/v1/storage/devices
   */
  async createDevice(deviceData: StorageDeviceCreateRequest): Promise<Device> {
    try {
      const response: AxiosResponse<Device> = await this.client.post(
        '/api/v1/storage/devices',
        deviceData
      );

      this.logger.logSuccess('Device created via Storage API', {
        deviceId: response.data.id,
        deviceName: response.data.name,
        deviceType: response.data.type
      });

      return response.data;
    } catch (error: any) {
      if (error.response?.status === 409) {
        throw new Error(`Device name already exists: ${deviceData.name}`);
      }
      this.logger.error('Failed to create device via Storage API', error, { deviceData });
      throw new Error(`Storage API error: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * 장비 정보 수정 (Storage API 경유)
   * PUT /api/v1/storage/devices/{id}
   */
  async updateDevice(id: string, updates: Partial<StorageDeviceCreateRequest>): Promise<Device> {
    try {
      const response: AxiosResponse<Device> = await this.client.put(
        `/api/v1/storage/devices/${id}`,
        updates
      );

      this.logger.logSuccess('Device updated via Storage API', {
        deviceId: id,
        updates: Object.keys(updates)
      });

      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error(`Device not found: ${id}`);
      }
      this.logger.error('Failed to update device via Storage API', error, { deviceId: id, updates });
      throw new Error(`Storage API error: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * 장비 삭제 (Storage API 경유)
   * DELETE /api/v1/storage/devices/{id}
   */
  async deleteDevice(id: string): Promise<void> {
    try {
      await this.client.delete(`/api/v1/storage/devices/${id}`);

      this.logger.logSuccess('Device deleted via Storage API', {
        deviceId: id
      });
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error(`Device not found: ${id}`);
      }
      this.logger.error('Failed to delete device via Storage API', error, { deviceId: id });
      throw new Error(`Storage API error: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  // ============ Group Management Operations ============

  /**
   * 그룹별 장비 조회 (Storage API 경유)
   * GET /api/v1/storage/devices/by-group/{groupId}
   */
  async getDevicesByGroup(groupId: string): Promise<Device[]> {
    try {
      const response: AxiosResponse<Device[]> = await this.client.get(
        `/api/v1/storage/devices/by-group/${groupId}`
      );

      this.logger.info('Devices by group retrieved from Storage API', {
        groupId,
        count: response.data.length
      });

      return response.data;
    } catch (error: any) {
      this.logger.error('Failed to get devices by group from Storage API', error, { groupId });
      throw new Error(`Storage API error: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  // ============ Cache Management Operations ============

  /**
   * 캐시 무효화 (Storage API 경유)
   * DELETE /api/v1/storage/cache/flush
   */
  async flushCache(): Promise<void> {
    try {
      await this.client.delete('/api/v1/storage/cache/flush');
      this.logger.info('Storage cache flushed successfully');
    } catch (error: any) {
      this.logger.error('Failed to flush Storage cache', error);
      throw new Error(`Storage API error: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  // ============ 연결 관리 ============

  /**
   * 장비의 복호화된 연결 정보 조회
   * GET /api/v1/storage/devices/{id}/connection-info
   */
  async getDecryptedConnectionInfo(id: string): Promise<DeviceConnectionInfo> {
    try {
      const response: AxiosResponse<DeviceConnectionInfo> = await this.client.get(
        `/api/v1/storage/devices/${id}/connection-info`
      );

      this.logger.info('Decrypted connection info retrieved from Storage API', {
        deviceId: id,
        protocol: response.data.protocol
      });

      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error(`Device not found: ${id}`);
      }
      this.logger.error('Failed to get decrypted connection info from Storage API', error, { deviceId: id });
      throw new Error(`Storage API error: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Storage Service 연결 테스트
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/api/v1/storage/health');
      
      // 200이고 데이터베이스와 캐시가 정상이면 OK (EventBus는 선택적)
      if (response.status === 200) {
        const isHealthy = response.data.checks?.database && response.data.checks?.cache;
        
        if (isHealthy) {
          this.logger.logSuccess('Storage Service connection verified (DB + Cache OK)');
          return true;
        } else {
          this.logger.logWarning('Storage Service DB/Cache issues', response.data);
          return false;
        }
      }
      
      // 503이지만 데이터베이스는 정상인 경우 (EventBus만 문제)
      if (response.status === 503 && response.data.checks?.database) {
        this.logger.logWarning('Storage Service partially available (EventBus down)', response.data);
        return true; // EventBus 없어도 기본 기능은 사용 가능
      }
      
      return false;
    } catch (error: any) {
      // 503 응답도 axios에서 에러로 처리되므로 별도 확인
      if (error.response?.status === 503 && error.response?.data?.checks?.database) {
        this.logger.logWarning('Storage Service partially available (EventBus down)', error.response.data);
        return true; // EventBus 없어도 기본 기능은 사용 가능
      }
      
      this.logger.logError('Storage Service connection failed', error);
      return false;
    }
  }
}
