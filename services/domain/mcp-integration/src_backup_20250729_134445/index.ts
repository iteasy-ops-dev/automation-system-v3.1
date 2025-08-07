/**
 * MCP Integration Service - Entry Point
 * 서비스의 메인 진입점
 */

import { MCPIntegrationApp } from './app';
import { Logger } from './utils/logger';

const logger = new Logger('mcp-entry');

async function startService(): Promise<void> {
  try {
    // 환경 변수 검증
    const requiredEnvs = ['DATABASE_URL', 'REDIS_URL', 'KAFKA_BROKERS'];
    const missingEnvs = requiredEnvs.filter(env => !process.env[env]);
    
    if (missingEnvs.length > 0) {
      throw new Error(`Missing required environment variables: ${missingEnvs.join(', ')}`);
    }

    logger.info('🚀 Starting MCP Integration Service...');
    
    const app = new MCPIntegrationApp();
    await app.initialize();
    await app.start();
    
    logger.info('🎉 MCP Integration Service is running successfully!');
    
  } catch (error) {
    logger.error('❌ Failed to start MCP Integration Service:', error);
    process.exit(1);
  }
}

// 서비스 시작
startService();
