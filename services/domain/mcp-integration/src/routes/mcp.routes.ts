/**
 * MCP API Routes
 * 라우팅 설정
 */

import { Router } from 'express';
import { MCPController } from '../controllers';
import { MCPIntegrationService } from '../services';

export function createMCPRoutes(mcpService: MCPIntegrationService): Router {
  const router = Router();
  const controller = new MCPController(mcpService);

  // 서버 관리
  router.post('/servers', (req, res, next) => 
    controller.createServer(req, res, next)
  );
  
  router.get('/servers', (req, res, next) => 
    controller.getServers(req, res, next)
  );
  
  router.get('/servers/:id', (req, res, next) => 
    controller.getServer(req, res, next)
  );
  
  router.put('/servers/:id', (req, res, next) => 
    controller.updateServer(req, res, next)
  );
  
  router.delete('/servers/:id', (req, res, next) => 
    controller.deleteServer(req, res, next)
  );

  // 연결 및 도구
  router.post('/servers/:id/test', (req, res, next) => 
    controller.testConnection(req, res, next)
  );
  
  router.get('/servers/:id/tools', (req, res, next) => 
    controller.getServerTools(req, res, next)
  );
  
  router.post('/discover', (req, res, next) => 
    controller.discoverTools(req, res, next)
  );

  // 실행
  router.post('/execute', (req, res, next) => 
    controller.executeTool(req, res, next)
  );
  
  router.get('/executions/:id', (req, res, next) => 
    controller.getExecution(req, res, next)
  );
  
  router.get('/executions', (req, res, next) => 
    controller.getExecutions(req, res, next)
  );

  return router;
}

export function createHealthRoute(mcpService: MCPIntegrationService): Router {
  const router = Router();
  const controller = new MCPController(mcpService);

  router.get('/health', (req, res, next) => 
    controller.healthCheck(req, res, next)
  );

  return router;
}
