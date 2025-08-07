/**
 * MCP 관련 타입 정의
 * 
 * 계약 기반: shared/contracts/v1.0/rest/domain/mcp-service.yaml
 * 백엔드 API와 100% 일치하는 타입 정의
 */

// MCP Server 기본 타입
export type MCPServerStatus = 'active' | 'inactive' | 'error' | 'connected' | 'disconnected' | 'connecting';
export type MCPConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';
export type MCPTransport = 'stdio' | 'ssh' | 'docker' | 'http';

// MCP Server 정보 (Model Context Protocol 표준 준수)
export interface MCPServer {
  id: string;
  name: string;
  description?: string;
  transport: MCPTransport;  // MCP 연결 방식
  status: MCPServerStatus;
  connectionStatus?: MCPConnectionStatus;
  
  // Transport별 설정
  command?: string;         // stdio transport용 실행 명령
  args?: string[];         // stdio transport용 인자
  sshConfig?: {            // ssh transport용
    host: string;
    port: number;
    username: string;
    password?: string;
    privateKey?: string;
    command: string;
  };
  dockerConfig?: {         // docker transport용
    image: string;
    container?: string;
    command?: string[];
  };
  httpConfig?: {           // http transport용
    url: string;
    headers?: Record<string, string>;
  };
  
  // MCP 서버 정보
  serverInfo?: {
    name: string;
    version: string;
    protocolVersion: string;
    capabilities: {
      tools?: boolean;
      resources?: boolean;
      prompts?: boolean;
      logging?: boolean;
    };
  };
  
  // UI에서 접근하는 capabilities (serverInfo에서 추출)
  capabilities?: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
    logging?: boolean;
  };
  
  // 메타데이터
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  lastHealthCheck?: string;
  lastError?: string;
}

// MCP Server 목록 응답
export interface MCPServerListResponse {
  items: MCPServer[];
  total: number;
  limit: number;
  offset: number;
}

// MCP Tool 정보 (MCP 표준 준수)
export interface MCPTool {
  id?: string;               // UI에서 사용하는 고유 ID (옵션)
  name: string;              // 도구 이름 (고유)
  description?: string;      // 도구 설명
  version?: string;          // 도구 버전 (UI 표시용)
  category?: string;         // 도구 카테고리 (UI 분류용)
  tags?: string[];           // 도구 태그들 (UI 필터링용)
  inputSchema: {            // JSON Schema for parameters
    type: 'object';
    properties?: Record<string, any>;
    required?: string[];
  };
  parameters?: MCPToolParameter[]; // UI에서 사용하는 파라미터 목록
}

// 추가 타입들 (UI에서 사용)
export interface MCPToolParameter {
  name: string;
  type: string;
  description?: string;
  required?: boolean;
  default?: any;
}

export interface MCPToolExample {
  name: string;
  description?: string;
  parameters: Record<string, any>;
  expectedOutput?: any;
}

// MCP Resource 정보
export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

// MCP Prompt 정보
export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

// MCP Tool 카탈로그
export interface MCPToolCatalog {
  serverId: string;
  serverName: string;
  tools: MCPTool[];
  lastUpdated: string;
}

// MCP Tool 실행 (JSON-RPC 2.0 표준)
export interface MCPExecutionRequest {
  serverId: string;
  method: string;  // tool name
  params?: Record<string, unknown>;
  async?: boolean;
}

export interface MCPExecutionResponse {
  executionId: string;
  status: 'completed' | 'failed' | 'pending' | 'running';
  result?: unknown;  // JSON-RPC result
  error?: {         // JSON-RPC error
    code: number;
    message: string;
    data?: unknown;
  };
  startedAt?: string;
  completedAt?: string;
  duration?: number;
}

export interface MCPExecutionStatus {
  executionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  result?: Record<string, unknown>;
  error?: string;
  logs?: string[];
  metadata?: Record<string, unknown>;
}

// MCP Server 생성/수정을 위한 타입
export interface MCPServerCreateRequest {
  name: string;
  description?: string;
  transport: MCPTransport;
  
  // Transport별 설정 (하나만 제공)
  command?: string;
  args?: string[];
  sshConfig?: {
    host: string;
    port: number;
    username: string;
    password?: string;
    privateKey?: string;
    command: string;
  };
  dockerConfig?: {
    image: string;
    container?: string;
    command?: string[];
  };
  httpConfig?: {
    url: string;
    headers?: Record<string, string>;
  };
  
  metadata?: Record<string, unknown>;
}

export interface MCPServerUpdateRequest {
  name?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  status?: MCPServerStatus;
  
  // Transport 설정은 수정 불가 (서버 재생성 필요)
}

// MCP Server 연결 테스트
export interface MCPConnectionTest {
  serverId: string;
  success: boolean;
  responseTime?: number;
  error?: string;
  capabilities?: string[];
  testedAt: string;
}

// 필터링 및 검색
export interface MCPServerFilters {
  status?: MCPServerStatus;
  type?: string;
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'type' | 'status' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface MCPToolFilters {
  serverId?: string;
  category?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface MCPExecutionFilters {
  serverId?: string;
  tool?: string;
  status?: 'pending' | 'running' | 'completed' | 'failed';
  start?: string;
  end?: string;
  limit?: number;
  offset?: number;
}

// UI 폼 데이터
export interface MCPServerFormData {
  name: string;
  description: string;
  transport: MCPTransport;
  
  // stdio transport
  command: string;
  args: string;
  
  // ssh transport
  sshHost: string;
  sshPort: number;
  sshUsername: string;
  sshPassword: string;
  sshPrivateKey: string;
  sshCommand: string;
  
  // docker transport
  dockerImage: string;
  dockerContainer: string;
  dockerCommand: string;
  
  // http transport
  httpUrl: string;
  httpHeaders: Record<string, string>;
  
  metadata: Record<string, string>;
}

// MCP Server 통계
export interface MCPServerStats {
  totalServers: number;
  activeServers: number;
  connectedServers: number;
  totalTools: number;
  recentExecutions: number;
  averageResponseTime: number;
}

// 에러 처리
export interface MCPError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

// MCP Tool 실행 이력
export interface MCPExecutionHistory {
  items: MCPExecutionResponse[];
  total: number;
  limit: number;
  offset: number;
}

// WebSocket 메시지 (실시간 업데이트용)
export interface MCPWebSocketMessage {
  type: 'server_status' | 'execution_update' | 'tool_discovery';
  serverId: string;
  data: {
    status?: MCPServerStatus;
    connectionStatus?: MCPConnectionStatus;
    execution?: MCPExecutionStatus;
    tools?: MCPTool[];
    error?: string;
  };
  timestamp: string;
}
