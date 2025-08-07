/**
 * API Gateway 서버 시작점
 * 통합 자동화 시스템 v3.1
 */

import { GatewayApp } from './app';

/**
 * 메인 실행 함수
 */
async function main(): Promise<void> {
  console.log('🚀 Starting API Gateway Service...');
  console.log('   Project: 통합 자동화 시스템 v3.1');
  console.log('   Service: API Gateway');
  console.log('   Version: 3.1.0');
  console.log('');

  try {
    // Gateway 애플리케이션 인스턴스 생성
    const gatewayApp = new GatewayApp();
    
    // 서버 시작
    await gatewayApp.start();
    
  } catch (error) {
    console.error('❌ Failed to start Gateway service:', error);
    process.exit(1);
  }
}

// 애플리케이션 시작
if (require.main === module) {
  main();
}

export { main };