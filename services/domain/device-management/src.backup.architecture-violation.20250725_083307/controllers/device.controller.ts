/**
 * Device Controller - REST API 엔드포인트
 * 계약(device-service.yaml) 100% 준수
 * TASK-8 성공 패턴: Controller → Service → Repository
 */

import { Request, Response } from 'express';
import { Logger } from '../utils/logger';
import { DeviceManagementService } from '../services/device-management.service';
import {
  DeviceListQuery,
  DeviceCreateRequest,
  DeviceUpdateRequest,
  HeartbeatRequest,
  MetricsQuery,
  DeviceServiceError,
  DeviceNotFoundError,
  ErrorResponse
} from '../types';

export class DeviceController {
  constructor(
    private deviceService: DeviceManagementService,
    private logger: Logger
  ) {}

  /**
   * GET /devices - 장비 목록 조회
   * 계약 준수: DeviceListResponse 반환
   */
  async getDevices(req: Request, res: Response): Promise<void> {
    try {
      const query: DeviceListQuery = {
        groupId: req.query.groupId as string,
        status: req.query.status as any,
        type: req.query.type as any,
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
        search: req.query.search as string,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string) : undefined
      };

      this.logger.info('GET /devices', { query, ip: req.ip });

      const result = await this.deviceService.getDevices(query);

      res.status(200).json(result);
    } catch (error) {
      this.handleError(res, error, 'GET /devices');
    }
  }

  /**
   * POST /devices - 장비 생성
   * 계약 준수: Device 반환
   */
  async createDevice(req: Request, res: Response): Promise<void> {
    try {
      const deviceData = req.body as DeviceCreateRequest;
      this.logger.info('POST /devices', { name: deviceData.name, type: deviceData.type, ip: req.ip });
      const device = await this.deviceService.createDevice(deviceData);
      res.status(201).json(device);
    } catch (error) {
      this.handleError(res, error, 'POST /devices');
    }
  }

  /**
   * GET /devices/{id} - 장비 상세 조회
   */
  async getDeviceById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const device = await this.deviceService.getDeviceById(id);
      res.status(200).json(device);
    } catch (error) {
      this.handleError(res, error, 'GET /devices/:id');
    }
  }

  /**
   * PUT /devices/{id} - 장비 정보 수정
   */
  async updateDevice(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData = req.body as DeviceUpdateRequest;
      const device = await this.deviceService.updateDevice(id, updateData);
      res.status(200).json(device);
    } catch (error) {
      this.handleError(res, error, 'PUT /devices/:id');
    }
  }

  /**
   * DELETE /devices/{id} - 장비 삭제
   */
  async deleteDevice(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await this.deviceService.deleteDevice(id);
      res.status(204).send();
    } catch (error) {
      this.handleError(res, error, 'DELETE /devices/:id');
    }
  }

  /**
   * GET /devices/{id}/status - 장비 상태 조회
   */
  async getDeviceStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const includeMetrics = req.query.includeMetrics === 'true';
      const includeErrors = req.query.includeErrors === 'true';

      const status = await this.deviceService.getDeviceStatus(id, {
        includeMetrics,
        includeErrors
      });

      res.status(200).json(status);
    } catch (error) {
      this.handleError(res, error, 'GET /devices/:id/status');
    }
  }

  /**
   * POST /devices/{id}/heartbeat - 하트비트 처리
   */
  async sendHeartbeat(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const heartbeatData = req.body as HeartbeatRequest;
      const response = await this.deviceService.processHeartbeat(id, heartbeatData);
      res.status(200).json(response);
    } catch (error) {
      this.handleError(res, error, 'POST /devices/:id/heartbeat');
    }
  }

  /**
   * GET /devices/{id}/metrics - 장비 메트릭 조회
   */
  async getDeviceMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const query: MetricsQuery = {
        metric: req.query.metric as any,
        start: req.query.start ? new Date(req.query.start as string) : undefined,
        end: req.query.end ? new Date(req.query.end as string) : undefined,
        interval: req.query.interval as string,
        aggregation: req.query.aggregation as any,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined
      };

      const metrics = await this.deviceService.getDeviceMetrics(id, query);
      res.status(200).json(metrics);
    } catch (error) {
      this.handleError(res, error, 'GET /devices/:id/metrics');
    }
  }

  /**
   * GET /devices/health - 전체 장비 건강 상태 조회
   */
  async getDevicesHealth(req: Request, res: Response): Promise<void> {
    try {
      const health = await this.deviceService.getDevicesHealth();
      res.status(200).json(health);
    } catch (error) {
      this.handleError(res, error, 'GET /devices/health');
    }
  }

  /**
   * 통합 에러 처리 (계약의 ErrorResponse 스키마 준수)
   */
  private handleError(res: Response, error: any, operation: string): void {
    this.logger.error(`Error in ${operation}`, { error: error.message, stack: error.stack });

    let statusCode = 500;
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred';

    if (error instanceof DeviceNotFoundError) {
      statusCode = 404;
      errorCode = 'DEVICE_NOT_FOUND';
      message = error.message;
    } else if (error instanceof DeviceServiceError) {
      statusCode = error.statusCode;
      errorCode = error.code;
      message = error.message;
    } else if (error.name === 'ValidationError') {
      statusCode = 400;
      errorCode = 'VALIDATION_ERROR';
      message = error.message;
    }

    const errorResponse: ErrorResponse = {
      error: errorCode,
      message: message,
      timestamp: new Date(),
      details: error instanceof DeviceServiceError ? error.details : undefined
    };

    res.status(statusCode).json(errorResponse);
  }
}
