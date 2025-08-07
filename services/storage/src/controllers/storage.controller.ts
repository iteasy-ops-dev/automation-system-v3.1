/**
 * Storage Controller - 계약 100% 준수 버전
 * shared/contracts/v1.0/rest/core/storage-api.yaml 계약 완전 준수
 * TASK-4-PRISMA: TypeScript 5.x 완전 호환
 */

import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { StorageService } from '../services/storage.service';
import { Logger } from '../utils/logger';
import { 
  DeviceFilter, 
  DeviceCreate, 
  DeviceUpdate,
  ErrorResponse,
  ValidationError
} from '../types/storage.types';
import { validationErrorHandler } from '../middleware/error.middleware';

export class StorageController {
  private readonly logger: Logger = new Logger('StorageController');

  constructor(private readonly storageService: StorageService) {}

  /**
   * GET /api/v1/storage/devices
   * 계약: storage-api.yaml - getDevices → DeviceListResponse
   */
  public getDevices = async (req: Request, res: Response): Promise<void> => {
    try {
      // 입력 검증
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const errorResponse = validationErrorHandler(errors.array());
        res.status(400).json(errorResponse);
        return;
      }

      // 필터 구성
      const filters: DeviceFilter = {
        groupId: req.query.groupId as string,
        status: req.query.status as string,
        type: req.query.type as string,
        search: req.query.search as string,
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc'
      };

      this.logger.debug('Getting devices', { filters });

      const result = await this.storageService.getDevices(filters);

      // 계약 100% 준수: DeviceListResponse 직접 반환
      // { items: Device[], total: number, limit: number, offset: number }
      res.status(200).json(result);

      this.logger.info('Devices retrieved successfully', { 
        total: result.total,
        returned: result.items.length,
        filters 
      });
    } catch (error) {
      this.logger.error('Error in getDevices', { error, query: req.query });
      this.sendErrorResponse(res, 500, 'Internal server error', error);
    }
  };

  /**
   * GET /api/v1/storage/devices/{id}
   * 계약: storage-api.yaml - getDevice → Device
   */
  public getDevice = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      this.logger.debug('Getting device', { id });

      const device = await this.storageService.getDevice(id);

      // 계약 100% 준수: Device 직접 반환
      res.status(200).json(device);

      this.logger.info('Device retrieved successfully', { 
        deviceId: device.id,
        name: device.name 
      });
    } catch (error) {
      this.logger.error('Error in getDevice', { error, id: req.params.id });
      
      if (error instanceof Error && error.message === 'Device not found') {
        this.sendErrorResponse(res, 404, 'Device not found');
      } else {
        this.sendErrorResponse(res, 500, 'Internal server error', error);
      }
    }
  };

  /**
   * POST /api/v1/storage/devices
   * 계약: storage-api.yaml - createDevice → Device
   */
  public createDevice = async (req: Request, res: Response): Promise<void> => {
    try {
      // 입력 검증
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const errorResponse = validationErrorHandler(errors.array());
        res.status(400).json(errorResponse);
        return;
      }

      const data: DeviceCreate = req.body;

      this.logger.debug('Creating device', { data });

      const device = await this.storageService.createDevice(data);

      // 계약 100% 준수: Device 직접 반환 (201 상태코드)
      res.status(201).json(device);

      this.logger.info('Device created successfully', { 
        deviceId: device.id,
        name: device.name 
      });
    } catch (error) {
      this.logger.error('Error in createDevice', { error, body: req.body });
      
      if (error instanceof Error && error.message.includes('already exists')) {
        this.sendErrorResponse(res, 409, 'Device already exists', error);
      } else {
        this.sendErrorResponse(res, 500, 'Internal server error', error);
      }
    }
  };

  /**
   * PUT /api/v1/storage/devices/{id}
   * 계약: storage-api.yaml - updateDevice → Device
   */
  public updateDevice = async (req: Request, res: Response): Promise<void> => {
    try {
      // 입력 검증
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const errorResponse = validationErrorHandler(errors.array());
        res.status(400).json(errorResponse);
        return;
      }

      const { id } = req.params;
      const data: DeviceUpdate = req.body;

      this.logger.debug('Updating device', { id, data });

      const device = await this.storageService.updateDevice(id, data);

      // 계약 100% 준수: Device 직접 반환
      res.status(200).json(device);

      this.logger.info('Device updated successfully', { 
        deviceId: device.id,
        name: device.name 
      });
    } catch (error) {
      this.logger.error('Error in updateDevice', { error, id: req.params.id, body: req.body });
      
      if (error instanceof Error && error.message === 'Device not found') {
        this.sendErrorResponse(res, 404, 'Device not found');
      } else {
        this.sendErrorResponse(res, 500, 'Internal server error', error);
      }
    }
  };

  /**
   * DELETE /api/v1/storage/devices/{id}
   * 계약: storage-api.yaml - deleteDevice → 204 No Content
   */
  public deleteDevice = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      this.logger.debug('Deleting device', { id });

      await this.storageService.deleteDevice(id);

      // 계약 100% 준수: 204 No Content
      res.status(204).send();

      this.logger.info('Device deleted successfully', { deviceId: id });
    } catch (error) {
      this.logger.error('Error in deleteDevice', { error, id: req.params.id });
      
      if (error instanceof Error && error.message === 'Device not found') {
        this.sendErrorResponse(res, 404, 'Device not found');
      } else {
        this.sendErrorResponse(res, 500, 'Internal server error', error);
      }
    }
  };

  /**
   * GET /api/v1/storage/devices/by-group/{groupId}
   * 그룹별 Device 조회 → Device[]
   */
  public getDevicesByGroup = async (req: Request, res: Response): Promise<void> => {
    try {
      const { groupId } = req.params;

      this.logger.debug('Getting devices by group', { groupId });

      const devices = await this.storageService.getDevicesByGroup(groupId);

      // 계약 준수: Device[] 배열 직접 반환
      res.status(200).json(devices);

      this.logger.info('Devices by group retrieved successfully', { 
        groupId,
        count: devices.length 
      });
    } catch (error) {
      this.logger.error('Error in getDevicesByGroup', { error, groupId: req.params.groupId });
      this.sendErrorResponse(res, 500, 'Internal server error', error);
    }
  };

  /**
   * DELETE /api/v1/storage/cache/flush
   * 캐시 무효화 → 204 No Content
   */
  public flushCache = async (req: Request, res: Response): Promise<void> => {
    try {
      this.logger.debug('Flushing cache');

      await this.storageService.flushCache();

      // 계약 준수: 204 No Content
      res.status(204).send();

      this.logger.info('Cache flushed successfully');
    } catch (error) {
      this.logger.error('Error in flushCache', error);
      this.sendErrorResponse(res, 500, 'Internal server error', error);
    }
  };

  /**
   * GET /api/v1/storage/cache/stats
   * 캐시 통계 조회 → CacheStats
   */
  public getCacheStats = async (req: Request, res: Response): Promise<void> => {
    try {
      this.logger.debug('Getting cache stats');

      const stats = await this.storageService.getCacheStats();

      // 계약 준수: CacheStats 직접 반환
      res.status(200).json(stats);

      this.logger.debug('Cache stats retrieved successfully');
    } catch (error) {
      this.logger.error('Error in getCacheStats', error);
      this.sendErrorResponse(res, 500, 'Internal server error', error);
    }
  };

  /**
   * GET /api/v1/storage/stats
   * 시스템 통계 조회 → SystemStats
   */
  public getSystemStats = async (req: Request, res: Response): Promise<void> => {
    try {
      this.logger.debug('Getting system stats');

      const stats = await this.storageService.getSystemStats();

      // 계약 준수: SystemStats 직접 반환
      res.status(200).json(stats);

      this.logger.debug('System stats retrieved successfully');
    } catch (error) {
      this.logger.error('Error in getSystemStats', error);
      this.sendErrorResponse(res, 500, 'Internal server error', error);
    }
  };

  /**
   * GET /api/v1/storage/health → HealthCheckResponse
   */
  public healthCheck = async (req: Request, res: Response): Promise<void> => {
    try {
      this.logger.debug('Performing health check');

      const health = await this.storageService.healthCheck();

      // 계약 준수: HealthCheckResponse 직접 반환
      const statusCode = health.healthy ? 200 : 503;
      res.status(statusCode).json(health);

      this.logger.info('Health check completed', { 
        healthy: health.healthy,
        checks: health.checks 
      });
    } catch (error) {
      this.logger.error('Error in healthCheck', error);
      this.sendErrorResponse(res, 500, 'Health check failed', error);
    }
  };

  /**
   * GET /api/v1/storage/devices/{id}/connection-info
   * 장비의 복호화된 연결 정보 조회
   */
  public getDecryptedConnectionInfo = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      this.logger.debug('Getting decrypted connection info', { id });

      const connectionInfo = await this.storageService.getDecryptedConnectionInfo(id);

      // 연결 정보 반환
      res.status(200).json(connectionInfo);

      this.logger.info('Connection info retrieved successfully', { 
        deviceId: id,
        protocol: connectionInfo.protocol 
      });
    } catch (error) {
      this.logger.error('Error in getDecryptedConnectionInfo', { error, id: req.params.id });
      
      if (error instanceof Error && error.message === 'Device not found') {
        this.sendErrorResponse(res, 404, 'Device not found');
      } else {
        this.sendErrorResponse(res, 500, 'Internal server error', error);
      }
    }
  };

  /**
   * 에러 응답 헬퍼 - 계약 준수 ErrorResponse
   */
  private sendErrorResponse(
    res: Response, 
    statusCode: number, 
    message: string, 
    details?: unknown
  ): void {
    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: statusCode,
        message,
        details: details instanceof Error ? details.message : details,
        timestamp: new Date().toISOString()
      }
    };

    res.status(statusCode).json(errorResponse);
  }
}
