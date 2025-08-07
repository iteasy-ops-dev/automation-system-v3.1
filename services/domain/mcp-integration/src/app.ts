/**
 * MCP Integration Service
 * Main Application
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import 'reflect-metadata';

import { MCPIntegrationService } from './services';
import { createMCPRoutes, createHealthRoute } from './routes';
import { errorHandler, requestLogger } from './middleware';

// 환경 변수 로드
dotenv.config();

// Express 앱 생성
const app = express();
const PORT = process.env.PORT || 8201;

// MCP Integration Service 인스턴스
const mcpService = new MCPIntegrationService();

// 미들웨어 설정
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// 라우트 설정
app.use('/', createHealthRoute(mcpService));
app.use('/api/v1/mcp', createMCPRoutes(mcpService));

// 직접 health check 라우트 정의
app.get('/api/v1/health', async (req, res) => {
  try {
    const health = await mcpService.healthCheck();
    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      service: 'mcp-integration',
      error: error.message
    });
  }
});

// 404 핸들러
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Resource not found'
    }
  });
});

// 에러 핸들러
app.use(errorHandler);

// 서버 시작
async function start() {
  try {
    // MCP Service 초기화
    await mcpService.initialize();
    
    // HTTP 서버 시작
    app.listen(PORT, () => {
      console.log(`MCP Integration Service started on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/v1/health`);
    });
  } catch (error) {
    console.error('Failed to start service:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await mcpService.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await mcpService.shutdown();
  process.exit(0);
});

// 애플리케이션 시작
start();

export default app;
