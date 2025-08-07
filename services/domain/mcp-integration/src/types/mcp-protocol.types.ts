/**
 * MCP (Model Context Protocol) 타입 정의
 * JSON-RPC 2.0 기반
 */

// JSON-RPC 2.0 기본 타입
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: any;
  id: string | number | null;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  result?: any;
  error?: JsonRpcError;
  id: string | number | null;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: any;
}

// MCP Initialize 관련 타입
export interface MCPInitializeRequest {
  protocolVersion: string;
  capabilities: MCPClientCapabilities;
  clientInfo: MCPClientInfo;
}

export interface MCPInitializeResponse {
  protocolVersion: string;
  capabilities: MCPServerCapabilities;
  serverInfo: MCPServerInfo;
}

export interface MCPClientInfo {
  name: string;
  version: string;
}

export interface MCPServerInfo {
  name: string;
  version: string;
}

export interface MCPClientCapabilities {
  experimental?: Record<string, any>;
  sampling?: {};
}

export interface MCPServerCapabilities {
  tools?: {};
  resources?: {};
  prompts?: {};
  logging?: {};
  experimental?: Record<string, any>;
}

// MCP Tool 관련 타입
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: {
    type: 'object';
    properties?: Record<string, any>;
    required?: string[];
  };
}

export interface MCPToolsListResponse {
  tools: MCPTool[];
}

export interface MCPToolCallRequest {
  name: string;
  arguments?: Record<string, any>;
}

export interface MCPToolCallResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

// MCP Resource 관련 타입
export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPResourcesListResponse {
  resources: MCPResource[];
}

export interface MCPResourceReadRequest {
  uri: string;
}

export interface MCPResourceReadResponse {
  contents: Array<{
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
  }>;
}

// MCP Prompt 관련 타입
export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

export interface MCPPromptsListResponse {
  prompts: MCPPrompt[];
}

export interface MCPPromptGetRequest {
  name: string;
  arguments?: Record<string, string>;
}

export interface MCPPromptGetResponse {
  messages: Array<{
    role: 'user' | 'assistant';
    content: {
      type: 'text';
      text: string;
    };
  }>;
}

// MCP 연결 상태
export type MCPConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// MCP 서버 상태
export type MCPServerStatus = 'active' | 'inactive' | 'maintenance';

// Transport 타입
export type MCPTransportType = 'stdio' | 'ssh' | 'http' | 'docker';
