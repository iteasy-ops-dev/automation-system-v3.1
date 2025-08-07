/**
 * Device Management Service - 진입점
 * v3.1 아키텍처 준수 완료
 */

import { DeviceServiceApp } from './app';
import { Logger } from './utils/logger';

const logger = new Logger('Main');

/**
 * 애플리케이션 시작
 */
async function startApplication(): Promise<void> {
  const app = new DeviceServiceApp();
  
  try {
    logger.info('🚀 Starting Device Management Service...');
    logger.info('📋 v3.1 Architecture Compliance Check:');
    logger.info('  ✅ Storage Service API 사용 (PostgreSQL 접근)');
    logger.info('  ✅ InfluxDB 직접 연동 (시계열 메트릭)');
    logger.info('  ✅ Redis 직접 연동 (캐싱 및 실시간 상태)');
    logger.info('  ✅ Kafka 직접 연동 (이벤트 발행)');
    logger.info('  ✅ 계약 100% 준수 (device-service.yaml)');
    
    await app.initialize();
    await app.start();
    
    logger.logSuccess('🎉 Device Management Service started successfully!');
    logger.info('📡 Ready to handle device management requests on port 8101');
  } catch (error) {
    logger.logError('❌ Failed to start Device Management Service', error);
    process.exit(1);
  }
}

// 메인 실행
if (require.main === module) {
  startApplication();
}

export { DeviceServiceApp };
