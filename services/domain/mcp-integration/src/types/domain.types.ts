/**
 * MCP Integration Service 도메인 타입
 * 계약: shared/contracts/v1.0/rest/domain/mcp-service.yaml
 */

import { MCPTransportType, MCPServerStatus, MCPConnectionStatus, MCPServerInfo } from './mcp-protocol.types';

// API 요청/응답 타입 (계약 준수)

export interface MCPServerCreate {
  name: string;
  description?: string;
  serverType?: string;      // 추가
  endpointUrl?: string;     // 추가
  transport: MCPTransportType;
  // Transport별 설정
  command?: string;         // stdio
  args?: string[];         // stdio
  sshConfig?: {           // ssh
    host: string;
    port: number;
    username: string;
    privateKey?: string;
    password?: string;
  };
  dockerConfig?: {        // docker
    image: string;
    container?: string;
    command?: string;
  };
  httpConfig?: {          // http
    url: string;
    headers?: Record<string, string>;
  };
  metadata?: Record<string, any>;
}

export interface MCPServerUpdate {
  name?: string;
  description?: string;
  status?: MCPServerStatus;
  command?: string;
  args?: string[];
  sshConfig?: any;
  dockerConfig?: any;
  httpConfig?: any;
  metadata?: Record<string, any>;
}

export interface MCPServer {
  id: string;
  name: string;
  description?: string;
  transport: MCPTransportType;
  status: MCPServerStatus;
  connectionStatus: MCPConnectionStatus;
  // Transport 설정
  command?: string;
  args?: string[];
  sshConfig?: any;
  dockerConfig?: any;
  httpConfig?: any;
  // MCP 서버 정보
  serverInfo?: MCPServerInfo;
  capabilities?: any;
  lastHeartbeat?: string;
  lastError?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface MCPServerListResponse {
  items: MCPServer[];
  total: number;
  limit: number;
  offset: number;
}

export interface MCPConnectionTest {
  serverId: string;
  success: boolean;
  message: string;
  serverInfo?: MCPServerInfo;
  duration: number;
}

export interface MCPExecutionRequest {
  serverId: string;
  method: string;
  params?: Record<string, any>;
  async?: boolean;
}

export interface MCPExecutionResponse {
  executionId: string;
  serverId: string;
  method: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
  startedAt: string;
  completedAt?: string;
  duration?: number;
}

export interface MCPToolResponse {
  serverId: string;
  name: string;
  description?: string;
  inputSchema?: any;
  version?: string;
}

// 내부 도메인 타입

export interface MCPConnection {
  serverId: string;
  transport: MCPTransportType;
  status: MCPConnectionStatus;
  connectedAt?: Date;
  lastActivity?: Date;
  serverInfo?: MCPServerInfo;
}

export interface MCPExecutionContext {
  executionId: string;
  serverId: string;
  method: string;
  params?: Record<string, any>;
  startedAt: Date;
  userId?: string;
  metadata?: Record<string, any>;
}

// Repository 필터
export interface MCPServerFilter {
  transport?: MCPTransportType;
  status?: MCPServerStatus;
  connectionStatus?: MCPConnectionStatus;
  search?: string;
}

export interface MCPExecutionFilter {
  serverId?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
}

// 이벤트 타입
export interface MCPServerEvent {
  type: 'registered' | 'updated' | 'deleted' | 'connected' | 'disconnected';
  serverId: string;
  timestamp: Date;
  data?: any;
}

export interface MCPExecutionEvent {
  type: 'started' | 'completed' | 'failed';
  executionId: string;
  serverId: string;
  timestamp: Date;
  data?: any;
}

// 에러 타입
export class MCPError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

export class MCPConnectionError extends MCPError {
  constructor(message: string, details?: any) {
    super(message, 'MCP_CONNECTION_ERROR', 503, details);
    this.name = 'MCPConnectionError';
  }
}

export class MCPExecutionError extends MCPError {
  constructor(message: string, details?: any) {
    super(message, 'MCP_EXECUTION_ERROR', 500, details);
    this.name = 'MCPExecutionError';
  }
}

export class MCPValidationError extends MCPError {
  constructor(message: string, details?: any) {
    super(message, 'MCP_VALIDATION_ERROR', 400, details);
    this.name = 'MCPValidationError';
  }
}
