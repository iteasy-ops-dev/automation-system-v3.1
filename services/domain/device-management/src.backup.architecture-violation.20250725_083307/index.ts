/**
 * Device Management Service - 진입점
 * TASK-8 성공 패턴 적용 완료
 */

import 'dotenv/config';
import { DeviceServiceApp } from './app';
import { createLogger } from './utils/logger';
import { Config } from './utils/config';

const logger = createLogger('Main');

async function bootstrap() {
  try {
    logger.info('Starting Device Management Service...', {
      version: '1.0.0',
      environment: Config.NODE_ENV,
      port: Config.PORT
    });

    const app = new DeviceServiceApp();
    await app.initialize();
    await app.start(Config.PORT);

    logger.info('Device Management Service is running successfully');
  } catch (error) {
    logger.error('Failed to start Device Management Service', { error });
    process.exit(1);
  }
}

// 부트스트랩 실행
bootstrap().catch((error) => {
  console.error('Fatal error during bootstrap:', error);
  process.exit(1);
});
