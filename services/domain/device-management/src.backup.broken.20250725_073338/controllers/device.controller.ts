/**
 * Device Controller
 * 장비 관리 REST API 엔드포인트
 */

import { Request, Response, Router } from 'express';
import { DeviceManagementService } from '../services';
import { createLogger } from '../utils/logger';
import { validateInput, deviceSchemas } from '../utils/validation';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export class DeviceController {
  private router = Router();
  private deviceService: DeviceManagementService;
  private logger = createLogger();

  constructor(deviceService: DeviceManagementService) {
    this.deviceService = deviceService;
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // 장비 CRUD
    this.router.get('/', this.getDevices.bind(this));
    this.router.post('/', this.createDevice.bind(this));
    this.router.get('/:id', this.getDevice.bind(this));
    this.router.put('/:id', this.updateDevice.bind(this));
    this.router.delete('/:id', this.deleteDevice.bind(this));
    
    // 장비 상태 관리
    this.router.get('/:id/status', this.getDeviceStatus.bind(this));
    this.router.post('/:id/heartbeat', this.receiveHeartbeat.bind(this));
    
    // 장비 메트릭
    this.router.get('/:id/metrics', this.getDeviceMetrics.bind(this));
    
    // 전체 건강 상태
    this.router.get('/health', this.getDevicesHealth.bind(this));
  }

  getRouter(): Router {
    return this.router;
  }

  // GET /api/v1/devices
  async getDevices(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const queryParams = validateInput(deviceSchemas.query, req.query);
      
      this.logger.info('장비 목록 조회 요청:', { 
        userId: req.user?.id,
        params: queryParams 
      });

      const result = await this.deviceService.getDevices(queryParams);
      
      res.json(result);
    } catch (error) {
      this.logger.error('장비 목록 조회 실패:', error);
      throw error;
    }
  }

  // POST /api/v1/devices
  async createDevice(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const deviceData = validateInput(deviceSchemas.create, req.body);
      
      this.logger.info('장비 생성 요청:', { 
        userId: req.user?.id,
        deviceName: deviceData.name,
        deviceType: deviceData.type 
      });

      const device = await this.deviceService.createDevice(deviceData, req.user?.id);
      
      res.status(201).json(device);
    } catch (error) {
      this.logger.error('장비 생성 실패:', error);
      throw error;
    }
  }

  // GET /api/v1/devices/:id
  async getDevice(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      this.logger.info('장비 상세 조회 요청:', { 
        userId: req.user?.id,
        deviceId: id 
      });

      const device = await this.deviceService.getDeviceById(id);
      
      if (!device) {
        res.status(404).json({
          error: 'DEVICE_NOT_FOUND',
          message: '장비를 찾을 수 없습니다',
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      res.json(device);
    } catch (error) {
      this.logger.error('장비 상세 조회 실패:', error);
      throw error;
    }
  }

  // PUT /api/v1/devices/:id
  async updateDevice(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData = validateInput(deviceSchemas.update, req.body);
      
      this.logger.info('장비 업데이트 요청:', { 
        userId: req.user?.id,
        deviceId: id,
        updateFields: Object.keys(updateData)
      });

      const device = await this.deviceService.updateDevice(id, updateData, req.user?.id);
      
      res.json(device);
    } catch (error) {
      this.logger.error('장비 업데이트 실패:', error);
      throw error;
    }
  }

  // DELETE /api/v1/devices/:id
  async deleteDevice(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      this.logger.info('장비 삭제 요청:', { 
        userId: req.user?.id,
        deviceId: id 
      });

      await this.deviceService.deleteDevice(id, req.user?.id);
      
      res.status(204).send();
    } catch (error) {
      this.logger.error('장비 삭제 실패:', error);
      throw error;
    }
  }

  // GET /api/v1/devices/:id/status
  async getDeviceStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const queryParams = validateInput(deviceSchemas.metricsQuery, req.query);
      
      this.logger.info('장비 상태 조회 요청:', { 
        userId: req.user?.id,
        deviceId: id,
        includeMetrics: queryParams.includeMetrics,
        includeErrors: queryParams.includeErrors
      });

      const status = await this.deviceService.getDeviceStatus(id, {
        includeMetrics: queryParams.includeMetrics,
        includeErrors: queryParams.includeErrors
      });
      
      if (!status) {
        res.status(404).json({
          error: 'DEVICE_NOT_FOUND',
          message: '장비를 찾을 수 없습니다',
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      res.json(status);
    } catch (error) {
      this.logger.error('장비 상태 조회 실패:', error);
      throw error;
    }
  }

  // POST /api/v1/devices/:id/heartbeat
  async receiveHeartbeat(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const heartbeatData = validateInput(deviceSchemas.heartbeat, req.body);
      
      this.logger.debug('하트비트 수신:', { 
        deviceId: id,
        status: heartbeatData.status,
        timestamp: heartbeatData.timestamp
      });

      await this.deviceService.processHeartbeat(id, heartbeatData);
      
      res.json({
        status: 'received',
        deviceId: id,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('하트비트 처리 실패:', error);
      throw error;
    }
  }

  // GET /api/v1/devices/:id/metrics
  async getDeviceMetrics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const queryParams = validateInput(deviceSchemas.metricsQuery, req.query);
      
      this.logger.info('장비 메트릭 조회 요청:', { 
        userId: req.user?.id,
        deviceId: id,
        metric: queryParams.metric,
        interval: queryParams.interval
      });

      const metrics = await this.deviceService.getDeviceMetrics(id, {
        metric: queryParams.metric,
        start: queryParams.start,
        end: queryParams.end,
        interval: queryParams.interval
      });
      
      res.json({
        deviceId: id,
        metrics,
        query: {
          metric: queryParams.metric,
          start: queryParams.start,
          end: queryParams.end,
          interval: queryParams.interval
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('장비 메트릭 조회 실패:', error);
      throw error;
    }
  }

  // GET /api/v1/devices/health
  async getDevicesHealth(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      this.logger.info('전체 장비 건강 상태 조회 요청:', { 
        userId: req.user?.id 
      });

      const healthSummary = await this.deviceService.getDevicesHealthSummary();
      
      res.json({
        summary: healthSummary,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('전체 장비 건강 상태 조회 실패:', error);
      throw error;
    }
  }
}
