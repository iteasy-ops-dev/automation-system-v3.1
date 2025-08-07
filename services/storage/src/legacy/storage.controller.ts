/**
 * Storage Controller
 * REST API 엔드포인트 구현 (계약 100% 준수)
 * shared/contracts/v1.0/rest/core/storage-api.yaml 기준
 */

import { Request, Response, NextFunction } from 'express';
import { StorageService } from '../services/storage.service';
import { Logger } from '../utils/logger';
import { CacheService } from '../services/cache.service';

export interface ApiRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
  correlationId?: string;
}

export interface ApiResponse extends Response {
  // 추가 메서드가 필요한 경우 여기에 정의
}

export interface PaginationQuery {
  limit?: string;
  offset?: string;
}

export interface DeviceQuery extends PaginationQuery {
  groupId?: string;
  status?: 'active' | 'inactive' | 'maintenance';
  type?: 'server' | 'network' | 'storage' | 'iot';
  name?: string;
  tags?: string;
}

export class StorageController {
  private logger: Logger;

  constructor(
    private storageService: StorageService,
    private cacheService: CacheService
  ) {
    this.logger = new Logger('StorageController');
  }

  // ========================================
  // Device Management Endpoints
  // ========================================

  /**
   * GET /storage/devices
   * 장비 목록 조회 (계약 준수)
   */
  getDevices = async (req: ApiRequest, res: ApiResponse, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as DeviceQuery;
      
      // 쿼리 파라미터 검증 및 변환
      const options = this.parseDeviceQuery(query);
      
      // 캐시 확인
      const cacheKey = this.generateCacheKey('devices:list', options);
      const cached = await this.cacheService.get(cacheKey);
      
      if (cached) {
        this.logger.debug('Serving devices from cache', { cacheKey });
        res.json(cached);
        return;
      }

      // 데이터 조회
      const result = await this.storageService.getDevices(options);

      // 응답 캐시 (30초)
      await this.cacheService.set(cacheKey, result, 30);

      // 계약 준수 응답
      res.json({
        items: result.items,
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        hasNext: result.hasNext,
        hasPrev: result.hasPrev
      });

      this.logger.info('Devices retrieved', {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        userId: req.user?.id
      });
    } catch (error) {
      this.handleError(error, req, res, next);
    }
  };

  /**
   * GET /storage/devices/{id}
   * 장비 단일 조회
   */
  getDevice = async (req: ApiRequest, res: ApiResponse, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      
      if (!this.isValidUUID(id)) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid device ID format',
          code: 'INVALID_ID_FORMAT'
        });
        return;
      }

      // 캐시 확인
      const cacheKey = this.generateCacheKey('device', { id });
      const cached = await this.cacheService.get(cacheKey);
      
      if (cached) {
        this.logger.debug('Serving device from cache', { id, cacheKey });
        res.json(cached);
        return;
      }

      // 데이터 조회
      const device = await this.storageService.getDevice(id);

      // 응답 캐시 (60초)
      await this.cacheService.set(cacheKey, device, 60);

      res.json(device);

      this.logger.debug('Device retrieved', { id, userId: req.user?.id });
    } catch (error) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          error: 'Not Found',
          message: `Device not found: ${req.params.id}`,
          code: 'DEVICE_NOT_FOUND'
        });
        return;
      }
      this.handleError(error, req, res, next);
    }
  };

  /**
   * POST /storage/devices
   * 장비 생성 (계약 준수)
   */
  createDevice = async (req: ApiRequest, res: ApiResponse, next: NextFunction): Promise<void> => {
    try {
      const deviceData = req.body;
      
      // 입력 검증
      const validationError = this.validateDeviceCreateInput(deviceData);
      if (validationError) {
        res.status(400).json({
          error: 'Bad Request',
          message: validationError,
          code: 'VALIDATION_ERROR'
        });
        return;
      }

      // 장비 생성
      const device = await this.storageService.createDevice(deviceData);

      // 관련 캐시 무효화
      await this.invalidateDeviceCache();

      res.status(201).json(device);

      this.logger.info('Device created', {
        id: device.id,
        name: device.name,
        type: device.type,
        userId: req.user?.id
      });
    } catch (error) {
      if (error.message.includes('already exists')) {
        res.status(409).json({
          error: 'Conflict',
          message: error.message,
          code: 'DEVICE_NAME_EXISTS'
        });
        return;
      }
      this.handleError(error, req, res, next);
    }
  };

  /**
   * PUT /storage/devices/{id}
   * 장비 수정
   */
  updateDevice = async (req: ApiRequest, res: ApiResponse, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      if (!this.isValidUUID(id)) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid device ID format',
          code: 'INVALID_ID_FORMAT'
        });
        return;
      }

      // 입력 검증
      const validationError = this.validateDeviceUpdateInput(updateData);
      if (validationError) {
        res.status(400).json({
          error: 'Bad Request',
          message: validationError,
          code: 'VALIDATION_ERROR'
        });
        return;
      }

      // 장비 수정
      const device = await this.storageService.updateDevice(id, updateData);

      // 관련 캐시 무효화
      await this.invalidateDeviceCache(id);

      res.json(device);

      this.logger.info('Device updated', {
        id,
        changes: Object.keys(updateData),
        userId: req.user?.id
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          error: 'Not Found',
          message: `Device not found: ${id}`,
          code: 'DEVICE_NOT_FOUND'
        });
        return;
      }
      this.handleError(error, req, res, next);
    }
  };

  /**
   * DELETE /storage/devices/{id}
   * 장비 삭제
   */
  deleteDevice = async (req: ApiRequest, res: ApiResponse, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      
      if (!this.isValidUUID(id)) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid device ID format',
          code: 'INVALID_ID_FORMAT'
        });
        return;
      }

      // 장비 삭제
      const deleted = await this.storageService.deleteDevice(id);

      if (!deleted) {
        res.status(404).json({
          error: 'Not Found',
          message: `Device not found: ${id}`,
          code: 'DEVICE_NOT_FOUND'
        });
        return;
      }

      // 관련 캐시 무효화
      await this.invalidateDeviceCache(id);

      res.status(204).send();

      this.logger.info('Device deleted', { id, userId: req.user?.id });
    } catch (error) {
      this.handleError(error, req, res, next);
    }
  };

  /**
   * POST /storage/devices/batch
   * 장비 배치 생성
   */
  createDevicesBatch = async (req: ApiRequest, res: ApiResponse, next: NextFunction): Promise<void> => {
    try {
      const devices = req.body.devices;
      
      if (!Array.isArray(devices) || devices.length === 0) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'devices array is required and cannot be empty',
          code: 'INVALID_BATCH_INPUT'
        });
        return;
      }

      if (devices.length > 100) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Batch size cannot exceed 100 devices',
          code: 'BATCH_SIZE_EXCEEDED'
        });
        return;
      }

      // 각 장비 입력 검증
      for (let i = 0; i < devices.length; i++) {
        const validationError = this.validateDeviceCreateInput(devices[i]);
        if (validationError) {
          res.status(400).json({
            error: 'Bad Request',
            message: `Device ${i}: ${validationError}`,
            code: 'VALIDATION_ERROR'
          });
          return;
        }
      }

      // 배치 생성
      const createdDevices = await this.storageService.createDevices(devices);

      // 관련 캐시 무효화
      await this.invalidateDeviceCache();

      res.status(201).json({
        devices: createdDevices,
        count: createdDevices.length
      });

      this.logger.info('Devices created in batch', {
        count: createdDevices.length,
        userId: req.user?.id
      });
    } catch (error) {
      this.handleError(error, req, res, next);
    }
  };

  // ========================================
  // Device Group Endpoints
  // ========================================

  /**
   * GET /storage/device-groups
   * 장비 그룹 목록 조회
   */
  getDeviceGroups = async (req: ApiRequest, res: ApiResponse, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as PaginationQuery & {
        parentId?: string;
        name?: string;
      };
      
      const options = this.parseGroupQuery(query);
      
      // 캐시 확인
      const cacheKey = this.generateCacheKey('groups:list', options);
      const cached = await this.cacheService.get(cacheKey);
      
      if (cached) {
        res.json(cached);
        return;
      }

      const result = await this.storageService.getDeviceGroups(options);

      // 응답 캐시 (5분)
      await this.cacheService.set(cacheKey, result, 300);

      res.json(result);

      this.logger.debug('Device groups retrieved', {
        total: result.total,
        userId: req.user?.id
      });
    } catch (error) {
      this.handleError(error, req, res, next);
    }
  };

  /**
   * GET /storage/device-groups/{id}
   * 장비 그룹 단일 조회
   */
  getDeviceGroup = async (req: ApiRequest, res: ApiResponse, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      
      if (!this.isValidUUID(id)) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid group ID format',
          code: 'INVALID_ID_FORMAT'
        });
        return;
      }

      const group = await this.storageService.getDeviceGroup(id);
      res.json(group);

      this.logger.debug('Device group retrieved', { id, userId: req.user?.id });
    } catch (error) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          error: 'Not Found',
          message: `Device group not found: ${req.params.id}`,
          code: 'GROUP_NOT_FOUND'
        });
        return;
      }
      this.handleError(error, req, res, next);
    }
  };

  /**
   * POST /storage/device-groups
   * 장비 그룹 생성
   */
  createDeviceGroup = async (req: ApiRequest, res: ApiResponse, next: NextFunction): Promise<void> => {
    try {
      const groupData = req.body;
      
      const validationError = this.validateGroupCreateInput(groupData);
      if (validationError) {
        res.status(400).json({
          error: 'Bad Request',
          message: validationError,
          code: 'VALIDATION_ERROR'
        });
        return;
      }

      const group = await this.storageService.createDeviceGroup(groupData);

      // 관련 캐시 무효화
      await this.invalidateGroupCache();

      res.status(201).json(group);

      this.logger.info('Device group created', {
        id: group.id,
        name: group.name,
        userId: req.user?.id
      });
    } catch (error) {
      this.handleError(error, req, res, next);
    }
  };

  /**
   * GET /storage/device-groups/tree
   * 그룹 트리 조회
   */
  getDeviceGroupTree = async (req: ApiRequest, res: ApiResponse, next: NextFunction): Promise<void> => {
    try {
      const { rootId } = req.query;
      
      const cacheKey = this.generateCacheKey('groups:tree', { rootId });
      const cached = await this.cacheService.get(cacheKey);
      
      if (cached) {
        res.json(cached);
        return;
      }

      const tree = await this.storageService.getDeviceGroupTree(rootId as string);

      // 캐시 (10분)
      await this.cacheService.set(cacheKey, tree, 600);

      res.json(tree);

      this.logger.debug('Device group tree retrieved', { rootId, userId: req.user?.id });
    } catch (error) {
      this.handleError(error, req, res, next);
    }
  };

  /**
   * GET /storage/device-groups/{id}/devices
   * 그룹별 장비 조회
   */
  getDevicesByGroup = async (req: ApiRequest, res: ApiResponse, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const query = req.query as PaginationQuery;
      
      if (!this.isValidUUID(id)) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid group ID format',
          code: 'INVALID_ID_FORMAT'
        });
        return;
      }

      const options = this.parsePaginationQuery(query);
      const result = await this.storageService.getDevicesByGroup(id, options);

      res.json(result);

      this.logger.debug('Devices by group retrieved', {
        groupId: id,
        total: result.total,
        userId: req.user?.id
      });
    } catch (error) {
      this.handleError(error, req, res, next);
    }
  };

  // ========================================
  // Cache Management Endpoints
  // ========================================

  /**
   * DELETE /storage/cache
   * 캐시 플러시
   */
  flushCache = async (req: ApiRequest, res: ApiResponse, next: NextFunction): Promise<void> => {
    try {
      const { pattern } = req.query;
      
      const deletedCount = await this.storageService.flushCache(pattern as string);

      res.json({
        message: 'Cache flushed successfully',
        deletedCount,
        pattern: pattern || 'all'
      });

      this.logger.info('Cache flushed', {
        pattern,
        deletedCount,
        userId: req.user?.id
      });
    } catch (error) {
      this.handleError(error, req, res, next);
    }
  };

  /**
   * GET /storage/cache/stats
   * 캐시 통계 조회
   */
  getCacheStats = async (req: ApiRequest, res: ApiResponse, next: NextFunction): Promise<void> => {
    try {
      const stats = await this.storageService.getCacheStats();
      res.json(stats);
    } catch (error) {
      this.handleError(error, req, res, next);
    }
  };

  // ========================================
  // System Endpoints
  // ========================================

  /**
   * GET /storage/health
   * 헬스체크
   */
  healthCheck = async (req: ApiRequest, res: ApiResponse, next: NextFunction): Promise<void> => {
    try {
      const health = await this.storageService.healthCheck();
      
      const statusCode = health.status === 'healthy' ? 200 : 503;
      res.status(statusCode).json(health);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date()
      });
    }
  };

  /**
   * GET /storage/stats
   * 시스템 통계
   */
  getSystemStats = async (req: ApiRequest, res: ApiResponse, next: NextFunction): Promise<void> => {
    try {
      const cacheKey = 'system:stats';
      const cached = await this.cacheService.get(cacheKey);
      
      if (cached) {
        res.json(cached);
        return;
      }

      const stats = await this.storageService.getSystemStats();

      // 캐시 (5분)
      await this.cacheService.set(cacheKey, stats, 300);

      res.json(stats);
    } catch (error) {
      this.handleError(error, req, res, next);
    }
  };

  // ========================================
  // Private Helper Methods
  // ========================================

  /**
   * Device 쿼리 파싱
   */
  private parseDeviceQuery(query: DeviceQuery) {
    const limit = Math.min(parseInt(query.limit || '20'), 100);
    const offset = Math.max(parseInt(query.offset || '0'), 0);
    
    const filter: any = {};
    
    if (query.groupId && this.isValidUUID(query.groupId)) {
      filter.groupId = query.groupId;
    }
    
    if (query.status && ['active', 'inactive', 'maintenance'].includes(query.status)) {
      filter.status = query.status;
    }
    
    if (query.type && ['server', 'network', 'storage', 'iot'].includes(query.type)) {
      filter.type = query.type;
    }
    
    if (query.name) {
      filter.name = query.name.trim();
    }
    
    if (query.tags) {
      filter.tags = query.tags.split(',').map(tag => tag.trim()).filter(Boolean);
    }

    return { limit, offset, filter };
  }

  /**
   * Group 쿼리 파싱
   */
  private parseGroupQuery(query: PaginationQuery & { parentId?: string; name?: string }) {
    const pagination = this.parsePaginationQuery(query);
    
    const filter: any = {};
    
    if (query.parentId !== undefined) {
      filter.parentId = query.parentId === 'null' ? null : query.parentId;
    }
    
    if (query.name) {
      filter.name = query.name.trim();
    }

    return { ...pagination, filter };
  }

  /**
   * 페이지네이션 쿼리 파싱
   */
  private parsePaginationQuery(query: PaginationQuery) {
    const limit = Math.min(parseInt(query.limit || '20'), 100);
    const offset = Math.max(parseInt(query.offset || '0'), 0);
    
    return { limit, offset };
  }

  /**
   * Device 생성 입력 검증
   */
  private validateDeviceCreateInput(data: any): string | null {
    if (!data || typeof data !== 'object') {
      return 'Request body must be an object';
    }

    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
      return 'name is required and must be a non-empty string';
    }

    if (data.name.length > 100) {
      return 'name must be 100 characters or less';
    }

    const validTypes = ['server', 'network', 'storage', 'iot'];
    if (!data.type || !validTypes.includes(data.type)) {
      return `type is required and must be one of: ${validTypes.join(', ')}`;
    }

    if (data.groupId && !this.isValidUUID(data.groupId)) {
      return 'groupId must be a valid UUID';
    }

    if (data.metadata && typeof data.metadata !== 'object') {
      return 'metadata must be an object';
    }

    if (data.tags && (!Array.isArray(data.tags) || !data.tags.every((tag: any) => typeof tag === 'string'))) {
      return 'tags must be an array of strings';
    }

    return null;
  }

  /**
   * Device 업데이트 입력 검증
   */
  private validateDeviceUpdateInput(data: any): string | null {
    if (!data || typeof data !== 'object') {
      return 'Request body must be an object';
    }

    if (Object.keys(data).length === 0) {
      return 'At least one field must be provided for update';
    }

    if (data.name !== undefined) {
      if (typeof data.name !== 'string' || data.name.trim().length === 0) {
        return 'name must be a non-empty string';
      }
      if (data.name.length > 100) {
        return 'name must be 100 characters or less';
      }
    }

    if (data.type !== undefined) {
      const validTypes = ['server', 'network', 'storage', 'iot'];
      if (!validTypes.includes(data.type)) {
        return `type must be one of: ${validTypes.join(', ')}`;
      }
    }

    if (data.status !== undefined) {
      const validStatuses = ['active', 'inactive', 'maintenance'];
      if (!validStatuses.includes(data.status)) {
        return `status must be one of: ${validStatuses.join(', ')}`;
      }
    }

    if (data.groupId !== undefined && data.groupId !== null && !this.isValidUUID(data.groupId)) {
      return 'groupId must be a valid UUID or null';
    }

    if (data.metadata !== undefined && typeof data.metadata !== 'object') {
      return 'metadata must be an object';
    }

    if (data.tags !== undefined && (!Array.isArray(data.tags) || !data.tags.every((tag: any) => typeof tag === 'string'))) {
      return 'tags must be an array of strings';
    }

    return null;
  }

  /**
   * Group 생성 입력 검증
   */
  private validateGroupCreateInput(data: any): string | null {
    if (!data || typeof data !== 'object') {
      return 'Request body must be an object';
    }

    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
      return 'name is required and must be a non-empty string';
    }

    if (data.name.length > 100) {
      return 'name must be 100 characters or less';
    }

    if (data.description && (typeof data.description !== 'string' || data.description.length > 500)) {
      return 'description must be a string of 500 characters or less';
    }

    if (data.parentId && !this.isValidUUID(data.parentId)) {
      return 'parentId must be a valid UUID';
    }

    if (data.metadata && typeof data.metadata !== 'object') {
      return 'metadata must be an object';
    }

    return null;
  }

  /**
   * UUID 유효성 검증
   */
  private isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * 캐시 키 생성
   */
  private generateCacheKey(prefix: string, params: any): string {
    const paramsStr = JSON.stringify(params, Object.keys(params).sort());
    const hash = Buffer.from(paramsStr).toString('base64').substring(0, 16);
    return `storage:${prefix}:${hash}`;
  }

  /**
   * Device 관련 캐시 무효화
   */
  private async invalidateDeviceCache(deviceId?: string): Promise<void> {
    const patterns = [
      'storage:devices:list:*',
      'storage:groups:*'
    ];

    if (deviceId) {
      patterns.push(`storage:device:*${deviceId}*`);
    }

    for (const pattern of patterns) {
      await this.cacheService.delPattern(pattern);
    }
  }

  /**
   * Group 관련 캐시 무효화
   */
  private async invalidateGroupCache(): Promise<void> {
    const patterns = [
      'storage:groups:*',
      'storage:devices:list:*'
    ];

    for (const pattern of patterns) {
      await this.cacheService.delPattern(pattern);
    }
  }

  /**
   * 에러 처리
   */
  private handleError(error: any, req: ApiRequest, res: ApiResponse, next: NextFunction): void {
    this.logger.error('API error', {
      error: error.message,
      stack: error.stack,
      method: req.method,
      url: req.url,
      userId: req.user?.id,
      correlationId: req.correlationId
    });

    // 개발 환경에서만 상세 에러 정보 노출
    const isDevelopment = process.env.NODE_ENV === 'development';

    res.status(500).json({
      error: 'Internal Server Error',
      message: isDevelopment ? error.message : 'An unexpected error occurred',
      code: 'INTERNAL_ERROR',
      correlationId: req.correlationId,
      ...(isDevelopment && { stack: error.stack })
    });
  }
}
