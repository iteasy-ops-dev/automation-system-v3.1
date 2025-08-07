/**
 * Device Controller - REST API 엔드포인트
 * shared/contracts/v1.0/rest/domain/device-service.yaml 계약 100% 준수
 */

import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { 
  DeviceFilter, 
  DeviceCreateRequest, 
  DeviceUpdateRequest,
  HeartbeatRequest,
  ErrorResponse 
} from '../types';
import { DeviceManagementService } from '../services/device-management.service';
import { Logger } from '../utils/logger';

export class DeviceController {
  private logger: Logger;

  constructor(private deviceService: DeviceManagementService) {
    this.logger = new Logger('DeviceController');
  }

  /**
   * GET /api/v1/devices - 장비 목록 조회
   */
  async getDevices(req: Request, res: Response): Promise<void> {
    try {
      // 입력 검증
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        this.sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'Invalid query parameters', {
          errors: errors.array()
        });
        return;
      }

      const filters: DeviceFilter = {
        groupId: req.query.groupId as string,
        status: req.query.status as any,
        type: req.query.type as any,
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0
      };

      const result = await this.deviceService.getDevices(filters);

      this.logger.info('Device list retrieved successfully', {
        count: result.items.length,
        total: result.total,
        filters
      });

      res.json(result);
    } catch (error) {
      this.handleError(res, error, 'getDevices');
    }
  }

  /**
   * POST /api/v1/devices - 장비 등록
   */
  async createDevice(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        this.sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'Invalid request body', {
          errors: errors.array()
        });
        return;
      }

      const deviceData: DeviceCreateRequest = req.body;
      const device = await this.deviceService.createDevice(deviceData);

      this.logger.logSuccess('Device created successfully', {
        deviceId: device.id,
        deviceName: device.name
      });

      res.status(201).json(device);
    } catch (error) {
      this.handleError(res, error, 'createDevice');
    }
  }

  /**
   * POST /api/v1/devices/{id}/status - 하트비트 처리
   */
  async processHeartbeat(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        this.sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'Invalid heartbeat data', {
          errors: errors.array()
        });
        return;
      }

      const deviceId = req.params.id;
      const heartbeat: HeartbeatRequest = req.body;

      await this.deviceService.processHeartbeat(deviceId, heartbeat);

      this.logger.debug('Heartbeat processed successfully', {
        deviceId,
        status: heartbeat.status
      });

      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        deviceId
      });
    } catch (error) {
      this.handleError(res, error, 'processHeartbeat', { deviceId: req.params.id });
    }
  }

  /**
   * GET /api/v1/devices/health - 전체 장비 헬스 요약
   */
  async getDeviceHealthSummary(req: Request, res: Response): Promise<void> {
    try {
      const summary = await this.deviceService.getDeviceHealthSummary();
      this.logger.info('Device health summary retrieved', summary);
      res.json(summary);
    } catch (error) {
      this.handleError(res, error, 'getDeviceHealthSummary');
    }
  }

  /**
   * GET /api/v1/devices/{id} - 장비 상세 조회
   */
  async getDeviceById(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        this.sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'Invalid request parameters', {
          errors: errors.array()
        });
        return;
      }

      const { id } = req.params;
      
      // DeviceService를 통해 조회
      const device = await this.deviceService.getDeviceById(id);
      
      if (!device) {
        this.sendErrorResponse(res, 404, 'DEVICE_NOT_FOUND', `Device with ID '${id}' not found`);
        return;
      }

      this.logger.info('Device retrieved successfully', { deviceId: id });
      res.json(device);
    } catch (error) {
      this.handleError(res, error, 'getDeviceById');
    }
  }

  /**
   * PUT /api/v1/devices/{id} - 장비 정보 수정
   */
  async updateDevice(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        this.sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'Invalid request parameters', {
          errors: errors.array()
        });
        return;
      }

      const { id } = req.params;
      const updateData = req.body;

      // DeviceService를 통해 업데이트
      const updatedDevice = await this.deviceService.updateDevice(id, updateData);

      this.logger.info('Device updated successfully', { 
        deviceId: id, 
        updatedFields: Object.keys(updateData) 
      });

      res.json(updatedDevice);
    } catch (error) {
      this.handleError(res, error, 'updateDevice');
    }
  }

  /**
   * DELETE /api/v1/devices/{id} - 장비 삭제
   */
  async deleteDevice(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        this.sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'Invalid request parameters', {
          errors: errors.array()
        });
        return;
      }

      const { id } = req.params;

      // DeviceService를 통해 삭제
      await this.deviceService.deleteDevice(id);

      this.logger.info('Device deleted successfully', { deviceId: id });

      // 204 No Content 응답
      res.status(204).send();
    } catch (error) {
      this.handleError(res, error, 'deleteDevice');
    }
  }

  /**
   * POST /api/v1/devices/{id}/test-connection - 장비 연결 테스트
   * 실제 연결을 시도하여 장비 접근성을 확인
   */
  async testConnection(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        this.sendErrorResponse(res, 400, 'VALIDATION_ERROR', 'Invalid request parameters', {
          errors: errors.array()
        });
        return;
      }

      const { id } = req.params;
      
      this.logger.info('Starting connection test', { deviceId: id });
      
      // DeviceService를 통해 연결 테스트 수행
      const result = await this.deviceService.testConnection(id);
      
      this.logger.info('Connection test completed', { 
        deviceId: id, 
        success: result.success,
        responseTime: result.responseTime 
      });

      res.json(result);
    } catch (error) {
      this.handleError(res, error, 'testConnection');
    }
  }

  /**
   * 에러 처리 (계약 준수 ErrorResponse)
   */
  private handleError(res: Response, error: any, operation: string, context?: any): void {
    this.logger.error(`Error in ${operation}`, error, context);

    let statusCode = 500;
    let errorCode = 'INTERNAL_ERROR';
    let message = 'Internal server error';

    // 에러 유형별 처리
    if (error.message?.includes('not found') || error.message?.includes('Not found')) {
      statusCode = 404;
      errorCode = 'NOT_FOUND';
      message = error.message;
    } else if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
      statusCode = 409;
      errorCode = 'CONFLICT';
      message = error.message;
    } else if (error.message?.includes('validation') || error.message?.includes('invalid')) {
      statusCode = 400;
      errorCode = 'VALIDATION_ERROR';
      message = error.message;
    } else if (error.message?.includes('Storage API error')) {
      statusCode = 502;
      errorCode = 'STORAGE_SERVICE_ERROR';
      message = 'Storage service unavailable';
    }

    this.sendErrorResponse(res, statusCode, errorCode, message, context);
  }

  /**
   * 에러 응답 전송 (계약 준수)
   */
  private sendErrorResponse(
    res: Response, 
    statusCode: number, 
    code: string, 
    message: string, 
    details?: any
  ): void {
    const errorResponse: ErrorResponse = {
      error: {
        code,
        message,
        timestamp: new Date().toISOString(),
        ...(details && { details })
      }
    };

    res.status(statusCode).json(errorResponse);
  }
}
