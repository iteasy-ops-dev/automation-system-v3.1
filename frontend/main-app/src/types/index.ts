/**
 * Type Definitions Index
 * 
 * 모든 타입 정의 내보내기
 */

// 인증 관련 타입
export type {
  UserRole,
  TokenType,
  LoginRequest,
  User,
  LoginResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  VerifyTokenResponse,
  AuthState,
  AuthActions,
  AuthContext,
  ApiErrorResponse,
  JWTPayload,
} from './auth';

export { AUTH_CONSTANTS } from './auth';

// WebSocket 관련 타입
export type {
  WebSocketMessageType,
  MessagePriority,
  WebSocketMessageMetadata,
  WebSocketMessage,
  ExecutionUpdatePayload,
  ExecutionUpdateMessage,
  MetricUpdatePayload,
  DeviceStatusPayload,
  WorkflowProgressPayload,
  ChatResponsePayload,
  AlertPayload,
  ErrorPayload,
  HeartbeatPayload,
  ConnectionStatusPayload,
  TypedWebSocketMessage,
  WebSocketState,
  WebSocketManager,
} from './websocket';

// API 관련 타입
export type {
  HttpMethod,
  ApiResponse,
  ApiError,
  PaginationParams,
  PaginatedResponse,
  SortParams,
  FilterParams,
  RequestConfig,
  ApiEndpoint,
  ApiClient,
} from './api';

// Workflow 관련 타입
export type {
  ChatWorkflowRequest,
  ChatWorkflowResponse,
  WorkflowIntent,
  WorkflowStepSummary,
  WorkflowExecutionStatus,
  WorkflowStep,
  WorkflowLog,
  WorkflowErrorResponse,
  ChatSession,
  ChatMessage,
  WorkflowProgressUpdate,
  ChatResponseUpdate,
} from './workflow';

// Chat UI 관련 타입
export type {
  ChatUIState,
  ChatUIMessage,
  ExecutionProgress,
  StepProgress,
  FileUpload,
  ChatAction,
  ChatContainerProps,
  MessageListProps,
  MessageInputProps,
  WorkflowProgressProps,
  FileUploadProps,
  ChatConfig,
  ChatTheme,
} from './chat';

// Device 관련 타입
export type {
  DeviceStatus,
  DeviceType,
  DeviceStatusInfo,
  MetricDataPoint,
  DeviceMetrics,
  DevicesHealthSummary,
  DeviceHealthDetail,
  DevicesHealth,
  DeviceAlert,
  DeviceAlertsResponse,
  Device,
  DeviceGroup,
  DeviceListResponse,
  DeviceCreateRequest,
  DeviceUpdateRequest,
  DeviceFilters,
  DeviceStatusFilters,
  DeviceMetricsFilters,
  DeviceAlertsFilters,
  DeviceFormData,
  DeviceSort,
  ConnectionProtocol,
  DeviceConnectionInfo,
} from './device';

// MCP 관련 타입
export type {
  MCPServerStatus,
  MCPConnectionStatus,
  MCPTransport,
  MCPServer,
  MCPServerListResponse,
  MCPTool,
  MCPToolParameter,
  MCPToolExample,
  MCPToolCatalog,
  MCPExecutionRequest,
  MCPExecutionResponse,
  MCPExecutionStatus,
  MCPServerCreateRequest,
  MCPServerUpdateRequest,
  MCPConnectionTest,
  MCPServerFilters,
  MCPToolFilters,
  MCPExecutionFilters,
  MCPServerFormData,
  MCPServerStats,
  MCPError,
  MCPExecutionHistory,
  MCPWebSocketMessage,
} from './mcp';
