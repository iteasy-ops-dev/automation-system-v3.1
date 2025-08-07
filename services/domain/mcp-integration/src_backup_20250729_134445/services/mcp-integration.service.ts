/**
 * MCP Integration Service - Model Context Protocol 표준 준수
 * shared/contracts/v1.0/rest/domain/mcp-service.yaml 계약 100% 준수
 * Transport Layer 완전 통합
 */

import { 
  MCPServerCreate, 
  MCPServerUpdate, 
  MCPServer, 
  MCPServerListResponse,
  MCPServerFilter,
  MCPExecutionRequest,
  MCPExecutionResponse,
  MCPConnectionTest,
  MCPDiscoverRequest,
  MCPDiscoverResponse,
  MCPTool,
  JsonRpcRequest,
  JsonRpcResponse,
  MCPConnectionError
} from '../types';

import { MCPServerRepository } from '../repositories/mcp-server.repository';
import { MCPExecutionRepository } from '../repositories/mcp-execution.repository';
import { MCPToolRepository } from '../repositories/mcp-tool.repository';
import { MCPConnectionPool, MCPTransportFactory } from '../transport';
import { EventBusService } from './event-bus.service';
import { QueueService } from './queue.service';
import { Logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class MCPIntegrationService {
  private readonly logger = Logger.getInstance();
  private readonly connectionPool: MCPConnectionPool;

  constructor(
    private readonly serverRepository: MCPServerRepository,
    private readonly executionRepository: MCPExecutionRepository,
    private readonly toolRepository: MCPToolRepository,
    private readonly eventBus: EventBusService,
    private readonly queue: QueueService
  ) {
    this.connectionPool = new MCPConnectionPool(50);
  }

  /**
   * MCP 서버 목록 조회
   * GET /api/v1/mcp/servers
   */
  async getServers(filters: MCPServerFilter): Promise<MCPServerListResponse> {
    try {
      this.logger.info('Retrieving MCP servers', { filters });
      
      return await this.serverRepository.findServers(filters);
    } catch (error) {
      this.logger.error('Failed to get MCP servers', {
        filters,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * MCP 서버 상세 조회
   * GET /api/v1/mcp/servers/{id}
   */
  async getServerById(id: string): Promise<MCPServer | null> {
    try {
      this.logger.debug('Retrieving MCP server by ID', { serverId: id });
      
      return await this.serverRepository.findById(id);
    } catch (error) {
      this.logger.error('Failed to get MCP server by ID', {
        serverId: id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }  /**
   * MCP 서버 등록 (MCP 표준 준수)
   * POST /api/v1/mcp/servers
   */
  async registerServer(data: MCPServerCreate): Promise<MCPServer> {
    try {
      this.logger.info('Registering MCP server', { 
        serverName: data.name, 
        transport: data.transport 
      });

      // 1. Transport 설정 검증
      MCPTransportFactory.validateTransportConfig(data);

      // 2. Transport 연결 테스트
      const transport = MCPTransportFactory.createTransport(data);
      
      try {
        await transport.connect();
        
        // 3. MCP 초기화 및 Capabilities 조회
        const serverInfo = await this.discoverServerCapabilities(transport);
        
        await transport.disconnect();
        
        // 4. 데이터베이스에 서버 저장
        const server = await this.serverRepository.createServer({
          ...data,
          serverInfo
        });

        // 5. 서버 상태를 active로 설정
        await this.serverRepository.updateServerStatus(
          server.id, 
          'active', 
          'disconnected'
        );

        // 6. 도구 디스커버리 비동기 실행
        this.queue.add('discover-tools', { serverId: server.id }, {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000
          }
        });

        // 7. 이벤트 발행
        await this.eventBus.publish('mcp-events', {
          eventId: uuidv4(),
          eventType: 'MCPServerRegistered',
          timestamp: new Date().toISOString(),
          serverId: server.id,
          payload: {
            serverName: server.name,
            transport: server.transport,
            capabilities: serverInfo?.capabilities
          }
        });

        this.logger.info('MCP server registered successfully', {
          serverId: server.id,
          serverName: server.name,
          transport: server.transport
        });

        return server;
      } catch (connectionError) {
        this.logger.error('Transport connection test failed during registration', {
          serverName: data.name,
          transport: data.transport,
          error: connectionError instanceof Error ? connectionError.message : String(connectionError)
        });
        throw new MCPConnectionError(`Failed to connect to MCP server: ${connectionError}`);
      }
    } catch (error) {
      this.logger.error('Failed to register MCP server', {
        serverName: data.name,
        transport: data.transport,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }  /**
   * MCP 서버 수정
   * PUT /api/v1/mcp/servers/{id}
   */
  async updateServer(id: string, data: MCPServerUpdate): Promise<MCPServer> {
    try {
      this.logger.info('Updating MCP server', { serverId: id, updates: Object.keys(data) });

      const server = await this.serverRepository.updateServer(id, data);

      this.logger.info('MCP server updated successfully', {
        serverId: id,
        serverName: server.name
      });

      return server;
    } catch (error) {
      this.logger.error('Failed to update MCP server', {
        serverId: id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * MCP 서버 삭제
   * DELETE /api/v1/mcp/servers/{id}
   */
  async deleteServer(id: string): Promise<boolean> {
    try {
      this.logger.info('Deleting MCP server', { serverId: id });

      // 1. 연결 풀에서 제거
      await this.connectionPool.removeConnection(id);

      // 2. 데이터베이스에서 삭제
      const deleted = await this.serverRepository.deleteServer(id);

      if (deleted) {
        // 3. 관련 도구들도 삭제
        await this.toolRepository.deleteToolsByServer(id);

        this.logger.info('MCP server deleted successfully', { serverId: id });
      }

      return deleted;
    } catch (error) {
      this.logger.error('Failed to delete MCP server', {
        serverId: id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * MCP 서버 연결 테스트
   * POST /api/v1/mcp/servers/{id}/test
   */
  async testConnection(id: string): Promise<MCPConnectionTest> {
    const startTime = Date.now();
    
    try {
      this.logger.info('Testing MCP server connection', { serverId: id });

      const server = await this.serverRepository.findById(id);
      if (!server) {
        throw new MCPConnectionError(`MCP server with ID '${id}' not found`);
      }

      const transport = MCPTransportFactory.createTransport(server);
      
      try {
        await transport.connect();
        
        // Ping 테스트
        const pingResponse = await transport.send({
          jsonrpc: '2.0',
          method: 'ping',
          id: 'connection-test'
        });

        // Capabilities 조회
        const capabilities = await this.discoverServerCapabilities(transport);
        
        await transport.disconnect();

        // 상태 업데이트
        await this.serverRepository.updateServerStatus(id, 'active', 'disconnected');

        const result: MCPConnectionTest = {
          serverId: id,
          success: true,
          responseTime: Date.now() - startTime,
          capabilities: capabilities?.capabilities,
          testedAt: new Date().toISOString()
        };

        this.logger.info('MCP server connection test successful', {
          serverId: id,
          responseTime: result.responseTime
        });

        return result;
      } catch (connectionError) {
        await transport.disconnect();
        
        // 에러 상태 업데이트
        const errorMessage = connectionError instanceof Error ? 
          connectionError.message : String(connectionError);
        
        await this.serverRepository.updateServerStatus(
          id, 
          'error', 
          'error', 
          errorMessage
        );

        return {
          serverId: id,
          success: false,
          error: errorMessage,
          responseTime: Date.now() - startTime,
          testedAt: new Date().toISOString()
        };
      }
    } catch (error) {
      this.logger.error('Failed to test MCP server connection', {
        serverId: id,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return {
        serverId: id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        responseTime: Date.now() - startTime,
        testedAt: new Date().toISOString()
      };
    }
  }  /**
   * MCP 도구 실행 (JSON-RPC 2.0 준수)
   * POST /api/v1/mcp/execute
   */
  async executeTool(request: MCPExecutionRequest): Promise<MCPExecutionResponse> {
    const executionId = uuidv4();
    const startTime = new Date();

    try {
      this.logger.info('Executing MCP tool', {
        executionId,
        serverId: request.serverId,
        method: request.method,
        async: request.async || false
      });

      // 1. 서버 조회
      const server = await this.serverRepository.findById(request.serverId);
      if (!server) {
        throw new MCPConnectionError(`MCP server with ID '${request.serverId}' not found`);
      }

      // 2. 실행 기록 생성
      await this.executionRepository.createExecution({
        id: executionId,
        serverId: request.serverId,
        method: request.method,
        params: request.params,
        status: 'pending',
        startedAt: startTime
      });

      // 3. 비동기 실행인 경우
      if (request.async) {
        this.queue.add('execute-tool', {
          executionId,
          serverId: request.serverId,
          method: request.method,
          params: request.params
        }, {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000
          }
        });

        return {
          executionId,
          status: 'pending',
          startedAt: startTime.toISOString()
        };
      }

      // 4. 동기 실행
      const result = await this.executeToolSync(server, request.method, request.params || {});
      const endTime = new Date();

      // 5. 실행 결과 저장
      await this.executionRepository.updateExecution(executionId, {
        status: 'completed',
        result: result.result,
        error: result.error,
        completedAt: endTime,
        durationMs: endTime.getTime() - startTime.getTime()
      });

      // 6. 이벤트 발행
      await this.eventBus.publish('mcp-events', {
        eventId: uuidv4(),
        eventType: 'ExecutionCompleted',
        timestamp: new Date().toISOString(),
        serverId: request.serverId,
        executionId,
        payload: {
          method: request.method,
          success: !result.error,
          duration: endTime.getTime() - startTime.getTime()
        }
      });

      return {
        executionId,
        status: result.error ? 'failed' : 'completed',
        result: result.result,
        error: result.error,
        startedAt: startTime.toISOString(),
        completedAt: endTime.toISOString(),
        duration: endTime.getTime() - startTime.getTime()
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // 에러 상태 저장
      await this.executionRepository.updateExecution(executionId, {
        status: 'failed',
        error: {
          code: -32603,
          message: errorMessage
        },
        completedAt: new Date()
      });

      this.logger.error('Failed to execute MCP tool', {
        executionId,
        serverId: request.serverId,
        method: request.method,
        error: errorMessage
      });

      throw error;
    }
  }  /**
   * 도구 디스커버리
   * POST /api/v1/mcp/discover
   */
  async discoverTools(request: MCPDiscoverRequest): Promise<MCPDiscoverResponse> {
    try {
      this.logger.info('Starting tool discovery', { 
        serverId: request.serverId || 'all' 
      });

      let servers: MCPServer[];
      
      if (request.serverId) {
        const server = await this.serverRepository.findById(request.serverId);
        servers = server ? [server] : [];
      } else {
        const response = await this.serverRepository.findServers({ 
          status: 'active',
          limit: 1000 
        });
        servers = response.items;
      }

      const results: MCPDiscoverResponse = {
        serversScanned: servers.length,
        toolsDiscovered: 0,
        errors: []
      };

      // 병렬로 도구 디스커버리 실행
      const discoveries = servers.map(server => 
        this.discoverServerTools(server).catch(error => ({
          serverId: server.id,
          tools: [],
          error: error instanceof Error ? error.message : String(error)
        }))
      );

      const discoveryResults = await Promise.allSettled(discoveries);

      for (let i = 0; i < discoveryResults.length; i++) {
        const result = discoveryResults[i];
        const server = servers[i];

        if (result.status === 'fulfilled') {
          const discovery = result.value;
          
          if (discovery.error) {
            results.errors.push({
              serverId: server.id,
              error: discovery.error
            });
          } else {
            results.toolsDiscovered += discovery.tools.length;
            
            // 도구 정보 저장
            for (const tool of discovery.tools) {
              await this.toolRepository.upsertTool({
                serverId: server.id,
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema
              });
            }
          }
        } else {
          results.errors.push({
            serverId: server.id,
            error: result.reason instanceof Error ? result.reason.message : String(result.reason)
          });
        }
      }

      // 이벤트 발행
      await this.eventBus.publish('mcp-events', {
        eventId: uuidv4(),
        eventType: 'ToolsDiscovered',
        timestamp: new Date().toISOString(),
        payload: {
          serversScanned: results.serversScanned,
          toolsDiscovered: results.toolsDiscovered,
          errorCount: results.errors.length
        }
      });

      this.logger.info('Tool discovery completed', results);
      return results;
    } catch (error) {
      this.logger.error('Failed to discover tools', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }  /**
   * MCP 서버 Capabilities 디스커버리
   */
  private async discoverServerCapabilities(transport: any): Promise<any> {
    try {
      const response = await transport.send({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: true,
            resources: true,
            prompts: true,
            logging: true
          },
          clientInfo: {
            name: 'automation-system-mcp-integration',
            version: '1.0.0'
          }
        },
        id: 'discover-capabilities'
      });

      if (response.error) {
        throw new MCPConnectionError(`Failed to discover capabilities: ${response.error.message}`);
      }

      return response.result;
    } catch (error) {
      this.logger.error('Failed to discover server capabilities', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * 서버의 도구 목록 디스커버리
   */
  private async discoverServerTools(server: MCPServer): Promise<{
    serverId: string;
    tools: MCPTool[];
    error?: string;
  }> {
    try {
      const transport = await this.connectionPool.getConnection(server);
      
      const response = await transport.send({
        jsonrpc: '2.0',
        method: 'tools/list',
        id: 'discover-tools'
      });

      await this.connectionPool.releaseConnection(server.id);

      if (response.error) {
        return {
          serverId: server.id,
          tools: [],
          error: response.error.message
        };
      }

      const tools: MCPTool[] = (response.result?.tools || []).map((tool: any) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema || { type: 'object', properties: {} }
      }));

      return {
        serverId: server.id,
        tools
      };
    } catch (error) {
      return {
        serverId: server.id,
        tools: [],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 동기 도구 실행
   */
  private async executeToolSync(server: MCPServer, method: string, params: Record<string, any>): Promise<{
    result?: any;
    error?: any;
  }> {
    try {
      const transport = await this.connectionPool.getConnection(server);
      
      const response = await transport.send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: method,
          arguments: params
        },
        id: uuidv4()
      });

      await this.connectionPool.releaseConnection(server.id);

      return {
        result: response.result,
        error: response.error
      };
    } catch (error) {
      return {
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  /**
   * 서비스 종료
   */
  async shutdown(): Promise<void> {
    try {
      await this.connectionPool.shutdown();
      this.logger.info('MCP Integration Service shutdown completed');
    } catch (error) {
      this.logger.error('Error during shutdown', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}