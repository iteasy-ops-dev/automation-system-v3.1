/**
 * MCP Service API Client
 * 
 * 계약 기반: shared/contracts/v1.0/rest/domain/mcp-service.yaml
 * 실제 백엔드 MCP Integration Service와 통신하는 클라이언트
 */

import { apiClient } from './api';
import type {
  MCPServer,
  MCPServerListResponse,
  MCPServerCreateRequest,
  MCPServerUpdateRequest,
  MCPServerFilters,
  MCPTool,
  MCPToolFilters,
  MCPExecutionRequest,
  MCPExecutionResponse,
  MCPExecutionStatus,
  MCPExecutionFilters,
  MCPExecutionHistory,
  MCPConnectionTest,
  MCPServerStats,
} from '@/types';

/**
 * MCP Server 관리
 */
export const mcpServerService = {
  /**
   * MCP 서버 목록 조회
   * GET /api/v1/mcp/servers
   */
  async getServers(filters: MCPServerFilters = {}): Promise<MCPServerListResponse> {
    const params = {
      status: filters.status,
      type: filters.type,
      search: filters.search,
      limit: filters.limit || 20,
      offset: filters.offset || 0,
      sortBy: filters.sortBy || 'createdAt',
      sortOrder: filters.sortOrder || 'desc',
    };

    // undefined 값 제거
    Object.keys(params).forEach(key => {
      if (params[key as keyof typeof params] === undefined) {
        delete params[key as keyof typeof params];
      }
    });

    return await apiClient.get<MCPServerListResponse>('/api/v1/mcp/servers', params);
  },

  /**
   * MCP 서버 상세 정보 조회
   * GET /api/v1/mcp/servers/{id}
   */
  async getServer(id: string): Promise<MCPServer> {
    return await apiClient.get<MCPServer>(`/api/v1/mcp/servers/${id}`);
  },

  /**
   * MCP 서버 등록
   * POST /api/v1/mcp/servers
   */
  async createServer(data: MCPServerCreateRequest): Promise<MCPServer> {
    return await apiClient.post<MCPServer>('/api/v1/mcp/servers', data);
  },

  /**
   * MCP 서버 정보 수정
   * PUT /api/v1/mcp/servers/{id}
   */
  async updateServer(id: string, data: MCPServerUpdateRequest): Promise<MCPServer> {
    return await apiClient.put<MCPServer>(`/api/v1/mcp/servers/${id}`, data);
  },

  /**
   * MCP 서버 삭제
   * DELETE /api/v1/mcp/servers/{id}
   */
  async deleteServer(id: string): Promise<void> {
    return await apiClient.delete<void>(`/api/v1/mcp/servers/${id}`);
  },

  /**
   * MCP 서버 연결 테스트
   * POST /api/v1/mcp/servers/{id}/test
   */
  async testConnection(id: string): Promise<MCPConnectionTest> {
    return await apiClient.post<MCPConnectionTest>(`/api/v1/mcp/servers/${id}/test`);
  },

  /**
   * MCP 서버 재시작
   * POST /api/v1/mcp/servers/{id}/restart
   */
  async restartServer(id: string): Promise<void> {
    return await apiClient.post<void>(`/api/v1/mcp/servers/${id}/restart`);
  },
};

/**
 * MCP Tool 관리
 */
export const mcpToolService = {
  /**
   * 서버의 도구 목록 조회
   * GET /api/v1/mcp/servers/{serverId}/tools
   */
  async getServerTools(serverId: string, filters: MCPToolFilters = {}): Promise<MCPTool[]> {
    const params = {
      category: filters.category,
      search: filters.search,
      limit: filters.limit,
      offset: filters.offset,
    };

    // undefined 값 제거
    Object.keys(params).forEach(key => {
      if (params[key as keyof typeof params] === undefined) {
        delete params[key as keyof typeof params];
      }
    });

    return await apiClient.get<MCPTool[]>(
      `/api/v1/mcp/servers/${serverId}/tools`, 
      params
    );
  },

  /**
   * 도구 상세 정보 조회
   * GET /api/v1/mcp/tools/{toolId}
   */
  async getTool(toolId: string): Promise<MCPTool> {
    return await apiClient.get<MCPTool>(`/api/v1/mcp/tools/${toolId}`);
  },

  /**
   * 도구 디스커버리 (서버에서 도구 목록 새로 가져오기)
   * POST /api/v1/mcp/discover
   */
  async discoverTools(serverId?: string): Promise<{ serversUpdated: number; toolsDiscovered: number }> {
    const data = serverId ? { serverId } : {};
    return await apiClient.post<{ serversUpdated: number; toolsDiscovered: number }>(
      '/api/v1/mcp/discover', 
      data
    );
  },
};

/**
 * MCP Tool 실행
 */
export const mcpExecutionService = {
  /**
   * 도구 실행
   * POST /api/v1/mcp/execute
   */
  async executeTool(request: MCPExecutionRequest): Promise<MCPExecutionResponse> {
    return await apiClient.post<MCPExecutionResponse>('/api/v1/mcp/execute', request);
  },

  /**
   * 실행 상태 조회
   * GET /api/v1/mcp/executions/{id}
   */
  async getExecutionStatus(id: string): Promise<MCPExecutionStatus> {
    return await apiClient.get<MCPExecutionStatus>(`/api/v1/mcp/executions/${id}`);
  },

  /**
   * 실행 이력 조회
   * GET /api/v1/mcp/executions
   */
  async getExecutionHistory(filters: MCPExecutionFilters = {}): Promise<MCPExecutionHistory> {
    const params = {
      serverId: filters.serverId,
      tool: filters.tool,
      status: filters.status,
      start: filters.start,
      end: filters.end,
      limit: filters.limit || 100,
      offset: filters.offset || 0,
    };

    // undefined 값 제거
    Object.keys(params).forEach(key => {
      if (params[key as keyof typeof params] === undefined) {
        delete params[key as keyof typeof params];
      }
    });

    return await apiClient.get<MCPExecutionHistory>('/api/v1/mcp/executions', params);
  },

  /**
   * 실행 취소
   * DELETE /api/v1/mcp/executions/{id}
   */
  async cancelExecution(id: string): Promise<void> {
    return await apiClient.delete<void>(`/api/v1/mcp/executions/${id}`);
  },
};

/**
 * MCP 통계 및 모니터링
 */
export const mcpStatsService = {
  /**
   * MCP 시스템 통계 조회
   * GET /api/v1/mcp/stats
   */
  async getStats(): Promise<MCPServerStats> {
    return await apiClient.get<MCPServerStats>('/api/v1/mcp/stats');
  },

  /**
   * 서버별 상태 확인
   * GET /api/v1/mcp/health
   */
  async getHealth(): Promise<Record<string, { status: string; lastCheck: string; error?: string }>> {
    return await apiClient.get<Record<string, { status: string; lastCheck: string; error?: string }>>(
      '/api/v1/mcp/health'
    );
  },
};

/**
 * 통합 MCP Service
 * 모든 MCP 관련 기능을 통합하여 제공
 */
export const mcpService = {
  // Server 관리
  servers: mcpServerService,
  
  // Tool 관리
  tools: mcpToolService,
  
  // 실행 관리
  executions: mcpExecutionService,
  
  // 통계 및 모니터링
  stats: mcpStatsService,
  
  // 편의 메서드들 (직접 접근)
  getServers: mcpServerService.getServers,
  getServer: mcpServerService.getServer,
  createServer: mcpServerService.createServer,
  updateServer: mcpServerService.updateServer,
  deleteServer: mcpServerService.deleteServer,
  testConnection: mcpServerService.testConnection,
  getServerTools: mcpToolService.getServerTools,
  executeTool: mcpExecutionService.executeTool,
  getExecutionStatus: mcpExecutionService.getExecutionStatus,
};

export default mcpService;
