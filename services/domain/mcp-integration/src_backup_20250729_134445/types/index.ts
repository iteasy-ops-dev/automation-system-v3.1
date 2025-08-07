/**
 * MCP Integration Service 타입 정의
 * Model Context Protocol 표준 준수
 * shared/contracts/v1.0/rest/domain/mcp-service.yaml 계약 100% 준수
 */

// ========== Transport 관련 타입 ==========

export type MCPTransport = 'stdio' | 'ssh' | 'docker' | 'http';

export interface SSHConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  command: string;
}

export interface DockerConfig {
  image: string;
  container?: string;
  command?: string[];
}

export interface HTTPConfig {
  url: string;
  headers?: Record<string, string>;
}

// ========== MCP Server 관련 타입 ==========

export interface MCPServerInfo {
  name: string;
  version: string;
  protocolVersion: string;
  capabilities: {
    tools: boolean;
    resources: boolean;
    prompts: boolean;
    logging: boolean;
  };
}

export interface MCPServerCreate {
  name: string;
  description?: string;
  transport: MCPTransport;
  
  // Transport별 설정 (하나만 제공)
  command?: string;
  args?: string[];
  sshConfig?: SSHConfig;
  dockerConfig?: DockerConfig;
  httpConfig?: HTTPConfig;
  
  metadata?: Record<string, any>;
}

export interface MCPServerUpdate {
  name?: string;
  description?: string;
  status?: 'active' | 'inactive' | 'error';
  metadata?: Record<string, any>;
  // Transport 설정은 수정 불가 (서버 재생성 필요)
}

export interface MCPServer {
  id: string;
  name: string;
  description?: string;
  transport: MCPTransport;
  status: 'active' | 'inactive' | 'error';
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error';
  
  // Transport별 설정
  command?: string;
  args?: string[];
  sshConfig?: SSHConfig;
  dockerConfig?: DockerConfig;
  httpConfig?: HTTPConfig;
  
  // MCP 서버 정보
  serverInfo?: MCPServerInfo;
  
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  lastHealthCheck?: string;
  lastError?: string;
}

export interface MCPServerListResponse {
  items: MCPServer[];
  total: number;
  limit: number;
  offset: number;
}

export interface MCPServerFilter {
  status?: 'active' | 'inactive' | 'error';
  transport?: MCPTransport;
  limit?: number;
  offset?: number;
}

// ========== MCP Tool 관련 타입 ==========

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

// ========== MCP Execution 관련 타입 ==========

export interface MCPExecutionRequest {
  serverId: string;
  method: string;  // 실행할 도구 이름 (JSON-RPC method)
  params?: Record<string, any>;  // 도구 파라미터 (JSON-RPC params)
  async?: boolean;
}

export interface MCPExecutionResponse {
  executionId: string;
  status: 'completed' | 'failed' | 'pending' | 'running';
  result?: any;  // JSON-RPC result
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  startedAt: string;
  completedAt?: string;
  duration?: number;  // 실행 시간 (ms)
}

export interface MCPExecutionStatus {
  executionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  logs?: string[];
  metadata?: Record<string, any>;
}

// ========== Connection Test 관련 타입 ==========

export interface MCPConnectionTest {
  serverId: string;
  success: boolean;
  responseTime?: number;  // 응답 시간 (ms)
  error?: string;
  capabilities?: {
    tools: boolean;
    resources: boolean;
    prompts: boolean;
    logging: boolean;
  };
  testedAt: string;
}

// ========== JSON-RPC 2.0 타입 ==========

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, any> | any[];
  id?: string | number;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  result?: any;
  error?: JsonRpcError;
  id?: string | number;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: any;
}

// ========== 내부 비즈니스 모델 ==========

export interface MCPExecution {
  id: string;
  serverId: string;
  method: string;
  params?: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: JsonRpcError;
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  executedBy?: string;
}

export interface MCPServerTool {
  id: string;
  serverId: string;
  name: string;  // 도구 이름 (서버 내 고유)
  description?: string;
  inputSchema: Record<string, any>;  // JSON Schema
  createdAt: Date;
  updatedAt: Date;
}

// ========== Transport 구현체 인터페이스 ==========

export interface MCPTransportConnection {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(request: JsonRpcRequest): Promise<JsonRpcResponse>;
  isConnected(): boolean;
  getLastError(): string | null;
}

export interface MCPTransportFactory {
  createConnection(server: MCPServer): MCPTransportConnection;
}

// ========== 이벤트 타입 (Kafka) ==========

export interface MCPEvent {
  eventId: string;
  eventType: 'MCPServerRegistered' | 'ToolsDiscovered' | 
            'ExecutionStarted' | 'ExecutionCompleted' | 'ExecutionFailed';
  timestamp: string;
  serverId?: string;
  executionId?: string;
  payload?: Record<string, any>;
}

// ========== Discovery 타입 ==========

export interface MCPDiscoverRequest {
  serverId?: string;  // 특정 서버만 검색 (비어있으면 전체)
}

export interface MCPDiscoverResponse {
  serversScanned: number;
  toolsDiscovered: number;
  errors: Array<{
    serverId: string;
    error: string;
  }>;
}

// ========== Connection Pool 타입 ==========

export interface MCPConnection {
  serverId: string;
  transport: MCPTransportConnection;
  status: 'connected' | 'disconnected' | 'error';
  lastUsed: Date;
  errorCount: number;
}

export interface MCPConnectionPool {
  maxConnections: number;
  activeConnections: Map<string, MCPConnection>;
  getConnection(serverId: string): Promise<MCPConnection>;
  releaseConnection(serverId: string): Promise<void>;
  healthCheck(): Promise<void>;
  cleanup(): Promise<void>;
}

// ========== Error 타입 ==========

export class MCPError extends Error {
  constructor(
    message: string,
    public code: number = -1,
    public data?: any
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

export class MCPConnectionError extends MCPError {
  constructor(message: string, data?: any) {
    super(message, -32603, data);  // JSON-RPC Internal error
    this.name = 'MCPConnectionError';
  }
}

export class MCPExecutionError extends MCPError {
  constructor(message: string, data?: any) {
    super(message, -32000, data);  // Server error
    this.name = 'MCPExecutionError';
  }
}
