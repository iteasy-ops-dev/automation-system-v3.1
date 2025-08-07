/**
 * Device Routes - 계약 기반 라우팅
 * device-service.yaml의 모든 경로 구현
 */

import { Router } from 'express';
import { DeviceController } from '../controllers/device.controller';
import { authMiddleware } from '../middleware/auth';
import { validationMiddleware } from '../middleware/validation';

export function createDeviceRoutes(deviceController: DeviceController): Router {
  const router = Router();

  // 인증 미들웨어 적용
  router.use(authMiddleware);

  // 장비 CRUD 라우트
  router.get('/devices', deviceController.getDevices.bind(deviceController));
  router.post('/devices', 
    validationMiddleware.validateDeviceCreate,
    deviceController.createDevice.bind(deviceController)
  );
  router.get('/devices/:id', deviceController.getDeviceById.bind(deviceController));
  router.put('/devices/:id',
    validationMiddleware.validateDeviceUpdate,
    deviceController.updateDevice.bind(deviceController)
  );
  router.delete('/devices/:id', deviceController.deleteDevice.bind(deviceController));

  // 장비 상태 및 메트릭 라우트
  router.get('/devices/:id/status', deviceController.getDeviceStatus.bind(deviceController));
  router.post('/devices/:id/heartbeat',
    validationMiddleware.validateHeartbeat,
    deviceController.sendHeartbeat.bind(deviceController)
  );
  router.get('/devices/:id/metrics', deviceController.getDeviceMetrics.bind(deviceController));

  // 건강 상태 라우트
  router.get('/devices/health', deviceController.getDevicesHealth.bind(deviceController));

  return router;
}
