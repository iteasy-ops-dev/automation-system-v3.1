import { GatewayApp } from './app';

/**
 * Gateway Service 진입점
 */
async function main(): Promise<void> {
  try {
    const app = new GatewayApp();
    
    // 애플리케이션 초기화
    await app.initialize();
    
    // 서버 시작
    await app.start();
    
  } catch (error) {
    console.error('Gateway 서비스 시작 실패:', error);
    process.exit(1);
  }
}

// Process 레벨 에러 처리
process.on('unhandledRejection', (reason, promise) => {
  console.error('처리되지 않은 Promise 거부:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('처리되지 않은 예외:', error);
  process.exit(1);
});

// 메인 함수 실행
if (require.main === module) {
  main();
}