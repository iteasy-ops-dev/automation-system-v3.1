/**
 * MCP Integration Service REST API Controller
 * shared/contracts/v1.0/rest/domain/mcp-service.yaml 계약 100% 준수
 * Model Context Protocol 표준 완전 지원
 */

import { Request, Response, NextFunction } from 'express';
import { MCPIntegrationService } from '../services/mcp-integration.service';
import { Logger } from '../utils/logger';
import { validateUUID, validatePagination } from '../utils/validation';
import { 
  MCPServerCreate, 
  MCPServerUpdate,
  MCPServerFilter,
  MCPExecutionRequest,
  MCPDiscoverRequest,
  MCPConnectionError
} from '../types';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
  };
}

export class MCPController {
  private service: MCPIntegrationService;
  private logger: Logger;

  constructor(service: MCPIntegrationService) {
    this.service = service;
    this.logger = new Logger('MCPController');
  }

  /**
   * MCP 서버 목록 조회
   * GET /api/v1/mcp/servers
   */
  async getServers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = this.buildServerFilters(req.query);
      
      this.logger.info('Getting MCP servers', { 
        filters,
        userId: req.user?.id 
      });

      const response = await this.service.getServers(filters);

      res.status(200).json(response);
    } catch (error) {
      this.logger.error('Failed to get MCP servers', {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id
      });
      next(error);
    }
  }  /**
   * MCP 서버 등록
   * POST /api/v1/mcp/servers
   */
  async registerServer(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const serverData = this.validateServerCreateData(req.body);

      this.logger.info('Registering MCP server', { 
        serverName: serverData.name,
        transport: serverData.transport,
        userId: req.user?.id 
      });

      const server = await this.service.registerServer(serverData);

      res.status(201).json(server);
    } catch (error) {
      this.logger.error('Failed to register MCP server', {
        serverName: req.body?.name,
        transport: req.body?.transport,
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id
      });
      next(error);
    }
  }

  /**
   * MCP 서버 수정
   * PUT /api/v1/mcp/servers/{id}
   */
  async updateServer(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      validateUUID(id, 'Server ID');

      const updateData = this.validateServerUpdateData(req.body);

      this.logger.info('Updating MCP server', { 
        serverId: id,
        updates: Object.keys(updateData),
        userId: req.user?.id 
      });

      const server = await this.service.updateServer(id, updateData);

      res.status(200).json(server);
    } catch (error) {
      this.logger.error('Failed to update MCP server', {
        serverId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id
      });
      next(error);
    }
  }

  /**
   * MCP 서버 삭제
   * DELETE /api/v1/mcp/servers/{id}
   */
  async deleteServer(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      validateUUID(id, 'Server ID');

      this.logger.info('Deleting MCP server', { 
        serverId: id,
        userId: req.user?.id 
      });

      const deleted = await this.service.deleteServer(id);

      if (!deleted) {
        res.status(404).json({
          error: 'MCP_SERVER_NOT_FOUND',
          message: `MCP server with ID '${id}' not found`,
          timestamp: new Date().toISOString()
        });
        return;
      }

      res.status(204).send();
    } catch (error) {
      this.logger.error('Failed to delete MCP server', {
        serverId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id
      });
      next(error);
    }
  }  /**
   * MCP 서버 연결 테스트
   * POST /api/v1/mcp/servers/{id}/test
   */
  async testConnection(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      validateUUID(id, 'Server ID');

      this.logger.info('Testing MCP server connection', { 
        serverId: id,
        userId: req.user?.id 
      });

      const result = await this.service.testConnection(id);

      res.status(200).json(result);
    } catch (error) {
      this.logger.error('Failed to test MCP server connection', {
        serverId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id
      });
      next(error);
    }
  }

  /**
   * MCP 도구 실행
   * POST /api/v1/mcp/execute
   */
  async executeTool(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const executionRequest = this.validateExecutionRequest(req.body);

      this.logger.info('Executing MCP tool', { 
        serverId: executionRequest.serverId,
        method: executionRequest.method,
        async: executionRequest.async,
        userId: req.user?.id 
      });

      const result = await this.service.executeTool(executionRequest);

      const statusCode = result.status === 'pending' ? 202 : 200;
      res.status(statusCode).json(result);
    } catch (error) {
      this.logger.error('Failed to execute MCP tool', {
        serverId: req.body?.serverId,
        method: req.body?.method,
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id
      });
      next(error);
    }
  }

  /**
   * 도구 디스커버리
   * POST /api/v1/mcp/discover
   */
  async discoverTools(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const discoverRequest = this.validateDiscoverRequest(req.body || {});

      this.logger.info('Discovering MCP tools', { 
        serverId: discoverRequest.serverId || 'all',
        userId: req.user?.id 
      });

      const result = await this.service.discoverTools(discoverRequest);

      res.status(200).json(result);
    } catch (error) {
      this.logger.error('Failed to discover MCP tools', {
        serverId: req.body?.serverId,
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id
      });
      next(error);
    }
  }  /**
   * 서버 필터 구성
   */
  private buildServerFilters(query: any): MCPServerFilter {
    const filters: MCPServerFilter = {};

    if (query.status && ['active', 'inactive', 'error'].includes(query.status)) {
      filters.status = query.status;
    }

    if (query.transport && ['stdio', 'ssh', 'docker', 'http'].includes(query.transport)) {
      filters.transport = query.transport;
    }

    // 페이지네이션 검증
    const { limit, offset } = validatePagination(query);
    filters.limit = limit;
    filters.offset = offset;

    return filters;
  }

  /**
   * 서버 생성 데이터 검증
   */
  private validateServerCreateData(data: any): MCPServerCreate {
    if (!data || typeof data !== 'object') {
      throw new MCPConnectionError('Request body is required');
    }

    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
      throw new MCPConnectionError('Server name is required and must be a non-empty string');
    }

    if (data.name.length > 100) {
      throw new MCPConnectionError('Server name must not exceed 100 characters');
    }

    if (!data.transport || !['stdio', 'ssh', 'docker', 'http'].includes(data.transport)) {
      throw new MCPConnectionError('Valid transport type is required (stdio, ssh, docker, http)');
    }

    const serverData: MCPServerCreate = {
      name: data.name.trim(),
      transport: data.transport
    };

    // 선택적 필드
    if (data.description) {
      if (typeof data.description !== 'string' || data.description.length > 500) {
        throw new MCPConnectionError('Description must be a string with max 500 characters');
      }
      serverData.description = data.description.trim();
    }

    // Transport별 설정 검증
    this.validateTransportSpecificData(serverData, data);

    // 메타데이터
    if (data.metadata) {
      if (typeof data.metadata !== 'object') {
        throw new MCPConnectionError('Metadata must be an object');
      }
      serverData.metadata = data.metadata;
    }

    return serverData;
  }

  /**
   * 서버 수정 데이터 검증
   */
  private validateServerUpdateData(data: any): MCPServerUpdate {
    if (!data || typeof data !== 'object') {
      throw new MCPConnectionError('Request body is required');
    }

    const updateData: MCPServerUpdate = {};

    if (data.name !== undefined) {
      if (typeof data.name !== 'string' || data.name.trim().length === 0) {
        throw new MCPConnectionError('Server name must be a non-empty string');
      }
      if (data.name.length > 100) {
        throw new MCPConnectionError('Server name must not exceed 100 characters');
      }
      updateData.name = data.name.trim();
    }

    if (data.description !== undefined) {
      if (data.description !== null && (typeof data.description !== 'string' || data.description.length > 500)) {
        throw new MCPConnectionError('Description must be a string with max 500 characters');
      }
      updateData.description = data.description?.trim();
    }

    if (data.status !== undefined) {
      if (!['active', 'inactive', 'error'].includes(data.status)) {
        throw new MCPConnectionError('Status must be one of: active, inactive, error');
      }
      updateData.status = data.status;
    }

    if (data.metadata !== undefined) {
      if (data.metadata !== null && typeof data.metadata !== 'object') {
        throw new MCPConnectionError('Metadata must be an object');
      }
      updateData.metadata = data.metadata;
    }

    return updateData;
  }  /**
   * Transport별 설정 데이터 검증
   */
  private validateTransportSpecificData(serverData: MCPServerCreate, data: any): void {
    switch (serverData.transport) {
      case 'stdio':
        if (!data.command || typeof data.command !== 'string') {
          throw new MCPConnectionError('Stdio transport requires command');
        }
        serverData.command = data.command.trim();
        
        if (data.args && Array.isArray(data.args)) {
          serverData.args = data.args.filter(arg => typeof arg === 'string');
        }
        break;

      case 'ssh':
        if (!data.sshConfig || typeof data.sshConfig !== 'object') {
          throw new MCPConnectionError('SSH transport requires sshConfig');
        }

        const ssh = data.sshConfig;
        if (!ssh.host || !ssh.username || !ssh.command) {
          throw new MCPConnectionError('SSH config requires host, username, and command');
        }

        if (!ssh.password && !ssh.privateKey) {
          throw new MCPConnectionError('SSH config requires either password or privateKey');
        }

        serverData.sshConfig = {
          host: ssh.host,
          port: ssh.port || 22,
          username: ssh.username,
          command: ssh.command,
          ...(ssh.password && { password: ssh.password }),
          ...(ssh.privateKey && { privateKey: ssh.privateKey })
        };
        break;

      case 'docker':
        if (!data.dockerConfig || !data.dockerConfig.image) {
          throw new MCPConnectionError('Docker transport requires dockerConfig with image');
        }

        serverData.dockerConfig = {
          image: data.dockerConfig.image,
          ...(data.dockerConfig.container && { container: data.dockerConfig.container }),
          ...(data.dockerConfig.command && { command: data.dockerConfig.command })
        };
        break;

      case 'http':
        if (!data.httpConfig || !data.httpConfig.url) {
          throw new MCPConnectionError('HTTP transport requires httpConfig with url');
        }

        try {
          new URL(data.httpConfig.url);
        } catch (error) {
          throw new MCPConnectionError('HTTP config requires valid URL');
        }

        serverData.httpConfig = {
          url: data.httpConfig.url,
          ...(data.httpConfig.headers && { headers: data.httpConfig.headers })
        };
        break;
    }
  }

  /**
   * 실행 요청 데이터 검증
   */
  private validateExecutionRequest(data: any): MCPExecutionRequest {
    if (!data || typeof data !== 'object') {
      throw new MCPConnectionError('Request body is required');
    }

    validateUUID(data.serverId, 'Server ID');

    if (!data.method || typeof data.method !== 'string') {
      throw new MCPConnectionError('Method name is required and must be a string');
    }

    const request: MCPExecutionRequest = {
      serverId: data.serverId,
      method: data.method.trim()
    };

    if (data.params !== undefined) {
      if (typeof data.params !== 'object') {
        throw new MCPConnectionError('Parameters must be an object');
      }
      request.params = data.params;
    }

    if (data.async !== undefined) {
      if (typeof data.async !== 'boolean') {
        throw new MCPConnectionError('Async flag must be a boolean');
      }
      request.async = data.async;
    }

    return request;
  }

  /**
   * 디스커버리 요청 데이터 검증
   */
  private validateDiscoverRequest(data: any): MCPDiscoverRequest {
    const request: MCPDiscoverRequest = {};

    if (data.serverId !== undefined) {
      validateUUID(data.serverId, 'Server ID');
      request.serverId = data.serverId;
    }

    return request;
  }
}