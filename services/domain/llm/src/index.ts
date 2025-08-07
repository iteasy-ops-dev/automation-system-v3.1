#!/usr/bin/env node

// LLM Service 메인 진입점

import { LLMApp } from './app';
import logger from './utils/logger';

async function main(): Promise<void> {
  try {
    logger.info('Starting LLM Service...');
    
    const app = new LLMApp();
    
    // 서비스 초기화
    await app.initialize();
    
    // 서버 시작
    await app.start();
    
  } catch (error) {
    logger.error('Failed to start LLM Service', { 
      error: {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        ...(error instanceof Error && 'code' in error ? { code: error.code } : {})
      }
    });
    process.exit(1);
  }
}

// 메인 함수 실행
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { LLMApp };
