#!/usr/bin/env node

/**
 * Workflow Engine Service
 * 통합 자동화 시스템 v3.1 - 워크플로우 엔진 서비스
 * 
 * 기능:
 * - 채팅 기반 워크플로우 오케스트레이션
 * - n8n 통합 실행 엔진
 * - Prisma 기반 메타데이터 관리
 * - MongoDB 기반 실행 데이터 저장
 * - 기존 서비스 통합 (LLM, MCP, Device)
 */

// Sentry 네이티브 모듈 오류 방지
process.env.SENTRY_DSN = '';
process.env.N8N_DISABLE_PRODUCTION_MAIN_PROCESS_WARNING = 'true';

const WorkflowEngineApp = require('./app');
const logger = require('./utils/logger');

async function main() {
  try {
    logger.info('🚀 Workflow Engine Service 시작...');

    const app = new WorkflowEngineApp();
    await app.start();

  } catch (error) {
    logger.error('❌ Workflow Engine Service 시작 실패:', error);
    process.exit(1);
  }
}

// 직접 실행 시에만 서버 시작
if (require.main === module) {
  main();
}

module.exports = WorkflowEngineApp;