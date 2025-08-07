/**
 * Development Mock Service
 * 개발환경에서 외부 의존성 없이 테스트하기 위한 Mock 서비스
 */

import logger from '../utils/logger';

export class MockService {
  async simulateHealthyService(): Promise<boolean> {
    return true;
  }

  async simulateConnection(): Promise<void> {
    logger.info('Mock service connected');
  }

  async simulateDisconnection(): Promise<void> {
    logger.info('Mock service disconnected');
  }
}

/**
 * 개발모드에서 실제 서비스 대신 Mock 사용
 */
export function createMockServices() {
  const mockService = new MockService();
  
  return {
    async connect() {
      await mockService.simulateConnection();
    },
    async disconnect() {
      await mockService.simulateDisconnection();
    },
    async healthCheck() {
      return await mockService.simulateHealthyService();
    }
  };
}
