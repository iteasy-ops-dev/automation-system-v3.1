/**
 * MCP Integration Service 라우터
 * 계약(shared/contracts/v1.0/rest/domain/mcp-service.yaml) 100% 준수
 * 
 * 모든 경로와 HTTP 메서드는 OpenAPI 계약과 1:1 일치
 */

import { Router } from 'express';
import { MCPController } from '../controllers/mcp.controller';
import { MCPIntegrationService } from '../services/mcp-integration.service';
import { authMiddleware } from '../middleware/auth.middleware';
import { errorHandler } from '../middleware/error.middleware';
import { requestLogger } from '../middleware/request-logger.middleware';

export function createMCPRouter(service: MCPIntegrationService): Router {
  const router = Router();
  const controller = new MCPController(service);

  // 미들웨어 적용
  router.use(requestLogger);
  router.use(authMiddleware);

  // ===== MCP 서버 관리 =====
  
  /**
   * GET /mcp/servers - MCP 서버 목록 조회
   * 계약: getMCPServers
   */
  router.get('/servers', controller.getServers.bind(controller));

  /**
   * POST /mcp/servers - MCP 서버 등록
   * 계약: registerMCPServer
   */
  router.post('/servers', controller.registerServer.bind(controller));

  /**
   * GET /mcp/servers/{id}/tools - MCP 서버 도구 목록 조회
   * 계약: getMCPServerTools
   */
  router.get('/servers/:id/tools', controller.getServerTools.bind(controller));

  // ===== MCP 도구 실행 =====

  /**
   * POST /mcp/execute - MCP 도구 실행
   * 계약: executeMCPTool
   */
  router.post('/execute', controller.executeTool.bind(controller));

  /**
   * GET /mcp/executions/{id} - 실행 상태 조회
   * 계약: getMCPExecution
   */
  router.get('/executions/:id', controller.getExecutionStatus.bind(controller));

  // ===== 도구 디스커버리 =====

  /**
   * POST /mcp/discover - 도구 디스커버리
   * 계약: discoverMCPTools
   */
  router.post('/discover', controller.discoverTools.bind(controller));

  // 에러 핸들러 (맨 마지막에 적용)
  router.use(errorHandler);

  return router;
}
