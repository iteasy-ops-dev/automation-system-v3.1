/**
 * Device Service API Client
 * 
 * 계약 기반: shared/contracts/v1.0/rest/domain/device-service.yaml
 * 실제 백엔드 Device Service와 통신하는 클라이언트
 */

import { apiClient } from './api';
import type {
  Device,
  DeviceListResponse,
  DeviceCreateRequest,
  DeviceUpdateRequest,
  DeviceFilters,
  DeviceStatusInfo,
  DeviceStatusFilters,
  DeviceMetrics,
  DeviceMetricsFilters,
  DevicesHealth,
  DeviceAlertsResponse,
  DeviceAlertsFilters,
} from '@/types';

/**
 * Storage Service를 통한 Device 기본 정보 관리
 */
export const deviceStorageService = {
  /**
   * 장비 목록 조회
   * GET /api/v1/devices
   */
  async getDevices(filters: DeviceFilters = {}): Promise<DeviceListResponse> {
    const params = {
      groupId: filters.groupId,
      status: filters.status,
      type: filters.type,
      search: filters.search,
      limit: filters.limit || 20,
      offset: filters.offset || 0,
      sortBy: filters.sortBy || 'createdAt',
      sortOrder: filters.sortOrder || 'desc',
    };

    // undefined 값 제거
    Object.keys(params).forEach(key => {
      if (params[key as keyof typeof params] === undefined) {
        delete params[key as keyof typeof params];
      }
    });

    return await apiClient.get<DeviceListResponse>('/api/v1/devices', params);
  },

  /**
   * 장비 상세 정보 조회
   * GET /api/v1/devices/{id}
   */
  async getDevice(id: string): Promise<Device> {
    return await apiClient.get<Device>(`/api/v1/devices/${id}`);
  },

  /**
   * 장비 등록
   * POST /api/v1/devices
   */
  async createDevice(data: DeviceCreateRequest): Promise<Device> {
    return await apiClient.post<Device>('/api/v1/devices', data);
  },

  /**
   * 장비 정보 수정
   * PUT /api/v1/devices/{id}
   */
  async updateDevice(id: string, data: DeviceUpdateRequest): Promise<Device> {
    return await apiClient.put<Device>(`/api/v1/devices/${id}`, data);
  },

  /**
   * 장비 삭제
   * DELETE /api/v1/devices/{id}
   */
  async deleteDevice(id: string): Promise<void> {
    return await apiClient.delete<void>(`/api/v1/devices/${id}`);
  },
};

/**
 * Device Service를 통한 실시간 모니터링 및 메트릭 관리
 */
export const deviceMonitoringService = {
  /**
   * 장비 현재 상태 조회
   * GET /api/v1/devices/{id}/status
   */
  async getDeviceStatus(
    id: string, 
    options: { includeMetrics?: boolean; includeErrors?: boolean } = {}
  ): Promise<DeviceStatusInfo> {
    const params = {
      includeMetrics: options.includeMetrics ?? true,
      includeErrors: options.includeErrors ?? true,
    };

    return await apiClient.get<DeviceStatusInfo>(
      `/api/v1/devices/${id}/status`, 
      params
    );
  },

  /**
   * 장비 메트릭 조회
   * GET /api/v1/devices/{id}/metrics
   */
  async getDeviceMetrics(id: string, filters: DeviceMetricsFilters = {}): Promise<DeviceMetrics> {
    const params = {
      metric: filters.metric,
      start: filters.start,
      end: filters.end,
      interval: filters.interval || '5m',
      aggregation: filters.aggregation || 'avg',
      limit: filters.limit || 1000,
    };

    // undefined 값 제거
    Object.keys(params).forEach(key => {
      if (params[key as keyof typeof params] === undefined) {
        delete params[key as keyof typeof params];
      }
    });

    return await apiClient.get<DeviceMetrics>(
      `/api/v1/devices/${id}/metrics`, 
      params
    );
  },

  /**
   * 전체 장비 건강 상태 조회
   * GET /api/v1/devices/health
   */
  async getDevicesHealth(filters: DeviceStatusFilters = {}): Promise<DevicesHealth> {
    const params = {
      groupId: filters.groupId,
      status: filters.status,
      critical: filters.critical,
    };

    // undefined 값 제거
    Object.keys(params).forEach(key => {
      if (params[key as keyof typeof params] === undefined) {
        delete params[key as keyof typeof params];
      }
    });

    return await apiClient.get<DevicesHealth>('/api/v1/devices/health', params);
  },

  /**
   * 장비 알림 목록 조회
   * GET /api/v1/devices/{id}/alerts
   */
  async getDeviceAlerts(id: string, filters: DeviceAlertsFilters = {}): Promise<DeviceAlertsResponse> {
    const params = {
      severity: filters.severity,
      status: filters.status,
      limit: filters.limit || 100,
      offset: filters.offset || 0,
    };

    // undefined 값 제거
    Object.keys(params).forEach(key => {
      if (params[key as keyof typeof params] === undefined) {
        delete params[key as keyof typeof params];
      }
    });

    return await apiClient.get<DeviceAlertsResponse>(
      `/api/v1/devices/${id}/alerts`, 
      params
    );
  },
};

/**
 * 통합 Device Service
 * Storage Service와 Device Service의 기능을 통합하여 제공
 */
export const deviceService = {
  // Storage Service 메서드들
  ...deviceStorageService,
  
  // Device Service 메서드들 (monitoring 프리픽스 제거)
  getStatus: deviceMonitoringService.getDeviceStatus,
  getMetrics: deviceMonitoringService.getDeviceMetrics,
  getHealth: deviceMonitoringService.getDevicesHealth,
  getAlerts: deviceMonitoringService.getDeviceAlerts,
  
  /**
   * 장비 연결 테스트
   * POST /api/v1/devices/{id}/test-connection
   */
  async testConnection(id: string): Promise<{
    success: boolean;
    protocol: string;
    responseTime: number;
    details?: Record<string, any>;
    error?: string;
    errorCode?: string;
  }> {
    return await apiClient.post(`/api/v1/devices/${id}/test-connection`);
  },
};

export default deviceService;
