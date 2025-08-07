/**
 * Device Management Background Scheduler
 * 주기적 작업 관리 (메트릭 수집, 헬스체크 등)
 */

import { DeviceManagementService } from '@/services/device-management.service';
import { DeviceRepository } from '@/repositories';
import { getLogger } from '@/utils';

export class DeviceScheduler {
  private deviceService: DeviceManagementService;
  private deviceRepository: DeviceRepository;
  private logger = getLogger();
  private intervals: NodeJS.Timeout[] = [];
  private isRunning = false;

  constructor(
    deviceService: DeviceManagementService,
    deviceRepository: DeviceRepository
  ) {
    this.deviceService = deviceService;
    this.deviceRepository = deviceRepository;
  }

  // 스케줄러 시작
  start(): void {
    if (this.isRunning) {
      this.logger.warn('Scheduler already running');
      return;
    }

    this.isRunning = true;
    this.logger.info('Starting device scheduler');

    // 메트릭 임계값 체크 (1분마다)
    const thresholdCheckInterval = setInterval(async () => {
      await this.runThresholdCheck();
    }, 60000);
    this.intervals.push(thresholdCheckInterval);

    // 헬스체크 (5분마다)
    const healthCheckInterval = setInterval(async () => {
      await this.runHealthCheck();
    }, 300000);
    this.intervals.push(healthCheckInterval);

    // 장비 상태 정리 (30분마다)
    const cleanupInterval = setInterval(async () => {
      await this.runCleanup();
    }, 1800000);
    this.intervals.push(cleanupInterval);

    this.logger.info('Device scheduler started with 3 jobs');
  }

  // 스케줄러 중지
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping device scheduler');
    
    this.intervals.forEach(interval => {
      clearInterval(interval);
    });
    this.intervals = [];
    this.isRunning = false;

    this.logger.info('Device scheduler stopped');
  }

  // 메트릭 임계값 체크 작업
  private async runThresholdCheck(): Promise<void> {
    try {
      this.logger.debug('Starting threshold check');

      // 활성 장비 목록 조회
      const devices = await this.deviceRepository.findDevices({
        status: 'active',
        limit: 1000
      });

      let checkedCount = 0;
      let alertCount = 0;

      // 각 장비의 임계값 체크
      for (const device of devices.items) {
        try {
          await this.deviceService.checkMetricThresholds(device.id);
          checkedCount++;
        } catch (error) {
          this.logger.error('Threshold check failed for device', error, { 
            deviceId: device.id 
          });
          alertCount++;
        }
      }

      this.logger.info('Threshold check completed', {
        totalDevices: devices.items.length,
        checkedCount,
        errorCount: alertCount
      });

    } catch (error) {
      this.logger.error('Threshold check job failed', error);
    }
  }

  // 헬스체크 작업
  private async runHealthCheck(): Promise<void> {
    try {
      this.logger.debug('Starting health check');

      // 활성 장비 목록 조회
      const devices = await this.deviceRepository.findDevices({
        status: 'active',
        limit: 1000
      });

      let checkedCount = 0;
      let unhealthyCount = 0;

      // 각 장비의 헬스체크
      for (const device of devices.items) {
        try {
          await this.deviceService.performHealthCheck(device.id);
          checkedCount++;
        } catch (error) {
          this.logger.error('Health check failed for device', error, { 
            deviceId: device.id 
          });
          unhealthyCount++;
        }
      }

      this.logger.info('Health check completed', {
        totalDevices: devices.items.length,
        checkedCount,
        unhealthyCount
      });

    } catch (error) {
      this.logger.error('Health check job failed', error);
    }
  }

  // 정리 작업
  private async runCleanup(): Promise<void> {
    try {
      this.logger.debug('Starting cleanup');

      // 캐시 정리, 오래된 상태 정리 등
      // 실제 구현에서는 TTL이 지난 데이터 정리
      
      this.logger.info('Cleanup completed');

    } catch (error) {
      this.logger.error('Cleanup job failed', error);
    }
  }

  // 상태 확인
  getStatus(): {
    isRunning: boolean;
    jobCount: number;
    uptime: number;
  } {
    return {
      isRunning: this.isRunning,
      jobCount: this.intervals.length,
      uptime: this.isRunning ? process.uptime() : 0
    };
  }
}
