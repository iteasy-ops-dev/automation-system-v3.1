/**
 * Device Management Service Entry Point
 * 애플리케이션 시작점
 */

import { DeviceManagementApp } from './app';
import { DeviceScheduler } from './utils/scheduler';
import { createLogger, config } from './utils';

const logger = createLogger(config.getConfig().logging);

async function main() {
  try {
    logger.info('Starting Device Management Service', {
      version: config.serviceVersion,
      environment: process.env.NODE_ENV,
      port: config.port
    });

    // Express 앱 생성 및 시작
    const app = new DeviceManagementApp();
    await app.start();

    logger.info('Device Management Service started successfully');

  } catch (error) {
    logger.error('Failed to start Device Management Service', error);
    process.exit(1);
  }
}

// 애플리케이션 시작
if (require.main === module) {
  main();
}

export { DeviceManagementApp };
