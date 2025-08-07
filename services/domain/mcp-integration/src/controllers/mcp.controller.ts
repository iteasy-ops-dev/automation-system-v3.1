/**
 * MCP Controller
 * API 엔드포인트 구현
 */

import { Request, Response, NextFunction } from 'express';
import {
  MCPServerCreate,
  MCPServerUpdate,
  MCPServerFilter,
  MCPExecutionRequest,
  MCPError
} from '../types';
import { MCPIntegrationService } from '../services';

export class MCPController {
  private mcpService: MCPIntegrationService;

  constructor(mcpService: MCPIntegrationService) {
    this.mcpService = mcpService;
  }

  /**
   * POST /api/v1/mcp/servers
   * 서버 등록
   */
  async createServer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data: MCPServerCreate = req.body;
      const server = await this.mcpService.registerServer(data);
      res.status(201).json(server);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/mcp/servers
   * 서버 목록 조회
   */
  async getServers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const filter: MCPServerFilter = {};
      if (req.query.transport) filter.transport = req.query.transport as any;
      if (req.query.status) filter.status = req.query.status as any;
      if (req.query.connectionStatus) filter.connectionStatus = req.query.connectionStatus as any;
      if (req.query.search) filter.search = req.query.search as string;

      const result = await this.mcpService.getServers(filter, limit, offset);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/mcp/servers/:id
   * 서버 상세 조회
   */
  async getServer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const serverId = req.params.id;
      const server = await this.mcpService.getServer(serverId);
      res.json(server);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/mcp/servers/:id
   * 서버 수정
   */
  async updateServer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const serverId = req.params.id;
      const data: MCPServerUpdate = req.body;
      const server = await this.mcpService.updateServer(serverId, data);
      res.json(server);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/mcp/servers/:id
   * 서버 삭제
   */
  async deleteServer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const serverId = req.params.id;
      await this.mcpService.deleteServer(serverId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/mcp/servers/:id/test
   * 연결 테스트
   */
  async testConnection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const serverId = req.params.id;
      const result = await this.mcpService.testConnection(serverId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/mcp/servers/:id/tools
   * 서버 도구 목록
   */
  async getServerTools(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const serverId = req.params.id;
      const tools = await this.mcpService.getServerTools(serverId);
      res.json(tools);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/mcp/discover
   * 도구 디스커버리
   */
  async discoverTools(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { serverId } = req.body;
      if (!serverId) {
        throw new MCPError('serverId is required', 'VALIDATION_ERROR', 400);
      }
      const tools = await this.mcpService.discoverTools(serverId);
      res.json(tools);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/mcp/execute
   * 도구 실행
   */
  async executeTool(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { serverId, tool, params, async } = req.body;
      
      // 파라미터 검증
      if (!serverId || !tool) {
        res.status(400).json({
          error: {
            code: 'INVALID_PARAMETERS',
            message: `Missing required parameters: serverId=${serverId}, tool=${tool}`
          }
        });
        return;
      }

      console.log(`🔧 도구 실행 요청: serverId=${serverId}, tool=${tool}`);
      
      // API 스키마 (tool) → 내부 스키마 (method) 변환
      const request: MCPExecutionRequest = {
        serverId,
        method: tool,  // 중요: tool → method 변환
        params,
        async
      };
      
      const result = await this.mcpService.executeTool(request);
      
      // 비동기 실행인 경우 202 반환
      const statusCode = request.async ? 202 : 200;
      res.status(statusCode).json(result);
    } catch (error) {
      console.error(`❌ 도구 실행 실패: ${error.message}`, error);
      next(error);
    }
  }

  /**
   * GET /api/v1/mcp/executions/:id
   * 실행 상태 조회
   */
  async getExecution(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const executionId = req.params.id;
      const execution = await this.mcpService.getExecution(executionId);
      res.json(execution);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/mcp/executions
   * 실행 이력 조회
   */
  async getExecutions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const serverId = req.query.serverId as string;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const result = await this.mcpService.getExecutions(serverId, limit, offset);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/health
   * 헬스 체크
   */
  async healthCheck(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const health = await this.mcpService.healthCheck();
      res.json(health);
    } catch (error) {
      next(error);
    }
  }
}
