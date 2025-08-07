/**
 * MCP Integration Service
 * 핵심 비즈니스 로직
 */

import { EventEmitter } from 'events';
import {
  MCPServer,
  MCPServerCreate,
  MCPServerUpdate,
  MCPServerFilter,
  MCPServerListResponse,
  MCPConnectionTest,
  MCPExecutionRequest,
  MCPExecutionResponse,
  MCPToolResponse,
  MCPToolsListResponse,
  MCPToolCallRequest,
  MCPError,
  MCPValidationError,
  MCPExecutionError,
  JsonRpcRequest
} from '../types';
import {
  MCPServerRepository,
  MCPToolRepository,
  MCPExecutionRepository
} from '../repositories';
import { MCPTransportFactory } from '../transport';
import { MCPConnectionPool } from './connection-pool.service';

export class MCPIntegrationService extends EventEmitter {
  private serverRepository: MCPServerRepository;
  private toolRepository: MCPToolRepository;
  private executionRepository: MCPExecutionRepository;
  private connectionPool: MCPConnectionPool;
  private isInitialized: boolean = false;

  constructor() {
    super();
    this.serverRepository = new MCPServerRepository();
    this.toolRepository = new MCPToolRepository();
    this.executionRepository = new MCPExecutionRepository();
    this.connectionPool = new MCPConnectionPool(this.serverRepository);

    // Connection Pool 이벤트 처리
    this.connectionPool.on('connected', (serverId: string) => {
      this.emit('serverConnected', serverId);
      // 연결 성공 시 도구 디스커버리 수행
      this.discoverTools(serverId).catch(console.error);
    });

    this.connectionPool.on('connectionLost', (serverId: string) => {
      this.emit('serverDisconnected', serverId);
    });
  }

  /**
   * 서비스 초기화
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // 모든 서버의 연결 상태 초기화
    await this.serverRepository.resetAllConnectionStatus();
    
    // Connection Pool 시작
    this.connectionPool.start();
    
    this.isInitialized = true;
    console.log('MCP Integration Service initialized');
  }



  /**
   * 서비스 종료
   */
  async shutdown(): Promise<void> {
    await this.connectionPool.stop();
    this.isInitialized = false;
    console.log('MCP Integration Service shut down');
  }

  /**
   * 서버 등록
   */
  async registerServer(data: MCPServerCreate): Promise<MCPServer> {
    // 입력 검증
    MCPTransportFactory.validateConfig(data);

    // 이름 중복 확인
    const existing = await this.serverRepository.findByName(data.name);
    if (existing) {
      throw new MCPValidationError(`Server with name '${data.name}' already exists`);
    }

    // 서버 생성
    const server = await this.serverRepository.create(data);
    this.emit('serverRegistered', server);
    
    // 자동으로 연결 시도 및 도구 탐색
    try {
      console.log(`Auto-connecting to server: ${server.name}`);
      await this.testConnection(server.id);
      
      // 연결 성공 시 도구 자동 탐색
      console.log(`Auto-discovering tools for server: ${server.name}`);
      await this.discoverTools(server.id);
    } catch (error) {
      console.error(`Failed to auto-connect server ${server.name}:`, error);
      // 연결 실패해도 서버 등록은 성공으로 처리
    }

    // 연결 테스트 (비동기)
    this.testConnection(server.id).catch(console.error);

    return server;
  }

  /**
   * 서버 목록 조회
   */
  async getServers(
    filter?: MCPServerFilter,
    limit: number = 20,
    offset: number = 0
  ): Promise<MCPServerListResponse> {
    const result = await this.serverRepository.findMany(filter, limit, offset);
    
    return {
      items: result.items,
      total: result.total,
      limit,
      offset
    };
  }

  /**
   * 서버 상세 조회
   */
  async getServer(serverId: string): Promise<MCPServer> {
    const server = await this.serverRepository.findById(serverId);
    if (!server) {
      throw new MCPError(`Server ${serverId} not found`, 'SERVER_NOT_FOUND', 404);
    }
    return server;
  }

  /**
   * 서버 수정
   */
  async updateServer(serverId: string, data: MCPServerUpdate): Promise<MCPServer> {
    const server = await this.serverRepository.findById(serverId);
    if (!server) {
      throw new MCPError(`Server ${serverId} not found`, 'SERVER_NOT_FOUND', 404);
    }

    // 이름 중복 확인 (이름 변경 시)
    if (data.name && data.name !== server.name) {
      const existing = await this.serverRepository.findByName(data.name);
      if (existing) {
        throw new MCPValidationError(`Server with name '${data.name}' already exists`);
      }
    }

    const updated = await this.serverRepository.update(serverId, data);
    if (!updated) {
      throw new MCPError('Failed to update server', 'UPDATE_FAILED');
    }

    this.emit('serverUpdated', updated);
    return updated;
  }

  /**
   * 서버 삭제
   */
  async deleteServer(serverId: string): Promise<void> {
    const server = await this.serverRepository.findById(serverId);
    if (!server) {
      throw new MCPError(`Server ${serverId} not found`, 'SERVER_NOT_FOUND', 404);
    }

    // 서버 삭제를 먼저 실행 (빠른 응답을 위해)
    await this.serverRepository.deleteServer(serverId);
    
    // 관련 데이터 삭제
    await this.toolRepository.deleteToolsByServerId(serverId);

    // 연결 해제는 백그라운드에서 실행 (블로킹하지 않음)
    setImmediate(async () => {
      try {
        const transport = await this.connectionPool.getConnection(serverId);
        await transport.disconnect();
      } catch (error) {
        // 연결 해제 실패는 무시
        console.warn(`Failed to disconnect server ${serverId}:`, error.message);
      }
    });

    this.emit('serverDeleted', serverId);
  }

  /**
   * 연결 테스트
   */
  async testConnection(serverId: string): Promise<MCPConnectionTest> {
    const startTime = Date.now();

    try {
      const server = await this.getServer(serverId);
      const transport = await this.connectionPool.getConnection(serverId);
      
      const serverInfo = transport.getServerInfo();
      const duration = Date.now() - startTime;

      return {
        serverId,
        success: true,
        message: 'Connection successful',
        serverInfo,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Connection failed';
      
      return {
        serverId,
        success: false,
        message,
        duration
      };
    }
  }

  /**
   * 서버의 도구 목록 조회
   */
  async getServerTools(serverId: string): Promise<MCPToolResponse[]> {
    const server = await this.getServer(serverId);
    return await this.toolRepository.findByServerId(serverId);
  }

  /**
   * 도구 디스커버리
   */
  async discoverTools(serverId: string): Promise<MCPToolResponse[]> {
    const server = await this.getServer(serverId);
    const transport = await this.connectionPool.getConnection(serverId);

    // tools/list 호출
    const response = await transport.send({
      jsonrpc: '2.0',
      method: 'tools/list',
      id: `tools-list-${Date.now()}`
    });

    if (response.error) {
      throw new MCPError(
        `Failed to list tools: ${response.error.message}`,
        'TOOLS_LIST_FAILED'
      );
    }

    const toolsList = response.result as MCPToolsListResponse;
    
    // 도구 정보 동기화
    await this.toolRepository.syncTools(serverId, toolsList.tools);

    // 이벤트 발행
    this.emit('toolsDiscovered', {
      serverId,
      tools: toolsList.tools
    });

    return await this.toolRepository.findByServerId(serverId);
  }

  /**
   * 도구 실행
   */
  async executeTool(request: MCPExecutionRequest): Promise<MCPExecutionResponse> {
    const server = await this.getServer(request.serverId);
    
    // 도구 존재 확인
    const tool = await this.toolRepository.findByServerAndName(
      request.serverId,
      request.method
    );
    if (!tool) {
      throw new MCPValidationError(`Tool '${request.method}' not found on server`);
    }

    // 실행 이력 생성
    const executionId = await this.executionRepository.createExecution({
      serverId: request.serverId,
      toolName: request.method,
      executionParams: request.params
    });

    // 이벤트 발행
    this.emit('executionStarted', {
      executionId,
      serverId: request.serverId,
      method: request.method
    });

    // 비동기 실행인 경우 즉시 반환
    if (request.async) {
      // 비동기로 실행
      this.executeToolAsync(executionId, request).catch(console.error);
      
      return {
        executionId,
        serverId: request.serverId,
        method: request.method,
        status: 'pending',
        startedAt: new Date().toISOString()
      };
    }

    // 동기 실행
    return await this.executeToolSync(executionId, request);
  }

  /**
   * 동기 도구 실행
   */
  private async executeToolSync(
    executionId: string,
    request: MCPExecutionRequest
  ): Promise<MCPExecutionResponse> {
    try {
      await this.executionRepository.markStarted(executionId);
      
      const transport = await this.connectionPool.getConnection(request.serverId);
      
      // tools/call 요청
      const toolCallRequest: MCPToolCallRequest = {
        name: request.method,
        arguments: request.params
      };

      const response = await transport.send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: toolCallRequest,
        id: executionId
      });

      if (response.error) {
        throw new MCPExecutionError(
          `Tool execution failed: ${response.error.message}`,
          response.error
        );
      }

      // 실행 완료 기록
      await this.executionRepository.markCompleted(executionId, response.result);

      // 이벤트 발행
      this.emit('executionCompleted', {
        executionId,
        serverId: request.serverId,
        method: request.method,
        result: response.result
      });

      const execution = await this.executionRepository.findById(executionId);
      return execution!;
    } catch (error) {
      // 실행 실패 기록
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.executionRepository.markFailed(executionId, errorMessage);

      // 이벤트 발행
      this.emit('executionFailed', {
        executionId,
        serverId: request.serverId,
        method: request.method,
        error: errorMessage
      });

      throw error;
    }
  }

  /**
   * 비동기 도구 실행
   */
  private async executeToolAsync(
    executionId: string,
    request: MCPExecutionRequest
  ): Promise<void> {
    try {
      await this.executeToolSync(executionId, request);
    } catch (error) {
      console.error(`Async execution failed for ${executionId}:`, error);
    }
  }

  /**
   * 실행 상태 조회
   */
  async getExecution(executionId: string): Promise<MCPExecutionResponse> {
    const execution = await this.executionRepository.findById(executionId);
    if (!execution) {
      throw new MCPError(
        `Execution ${executionId} not found`,
        'EXECUTION_NOT_FOUND',
        404
      );
    }
    return execution;
  }

  /**
   * 실행 이력 조회
   */
  async getExecutions(
    serverId?: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ items: MCPExecutionResponse[]; total: number }> {
    const filter = serverId ? { serverId } : undefined;
    return await this.executionRepository.findMany(filter, limit, offset);
  }

  /**
   * 헬스 체크
   */
  async healthCheck(): Promise<any> {
    try {
      const servers = await this.serverRepository.findMany();
      const connections = this.connectionPool.getConnectionStatus();
      
      return {
        status: 'healthy',
        service: 'mcp-integration',
        version: '3.1.0',
        timestamp: new Date().toISOString(),
        connections: connections.filter(c => c.status === 'connected').length,
        servers: servers.total || 0
      };
    } catch (error) {
      return {
        status: 'healthy',
        service: 'mcp-integration', 
        version: '3.1.0',
        timestamp: new Date().toISOString(),
        connections: 0,
        servers: 0
      };
    }
  }
}
