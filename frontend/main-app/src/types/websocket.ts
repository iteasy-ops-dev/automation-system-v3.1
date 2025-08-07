/**
 * WebSocket Message Types
 * 
 * TASK-2 WebSocket 계약 100% 준수
 * shared/contracts/v1.0/events/websocket-messages.json 기반
 */

// WebSocket 메시지 타입 (계약에서 정의됨)
export type WebSocketMessageType = 
  | 'execution_update'
  | 'metric_update'
  | 'device_status'
  | 'workflow_progress'
  | 'chat_response'
  | 'alert'
  | 'error'
  | 'heartbeat'
  | 'connection_status';

// 메시지 우선순위 (계약에서 정의됨)
export type MessagePriority = 'low' | 'normal' | 'high' | 'urgent';

// WebSocket 메시지 메타데이터 (계약 기반)
export interface WebSocketMessageMetadata {
  messageId?: string; // UUID format
  correlationId?: string; // UUID format
  userId?: string;
  sessionId?: string; // UUID format
  priority?: MessagePriority;
  version?: string;
}

// 기본 WebSocket 메시지 구조 (계약 준수)
export interface WebSocketMessage {
  type: WebSocketMessageType;
  timestamp: string; // ISO date-time format
  payload?: Record<string, unknown>; // 메시지별 페이로드
  metadata?: WebSocketMessageMetadata;
}
// 특정 메시지 타입별 페이로드

// 실행 업데이트 메시지
export interface ExecutionUpdatePayload {
  executionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number; // 0-100
  stepName?: string;
  result?: Record<string, unknown>;
  error?: string;
  finishedAt?: string; // ISO date-time format
}

// 타입 별칭 추가
export type ExecutionUpdateMessage = ExecutionUpdatePayload;

// 메트릭 업데이트 메시지
export interface MetricUpdatePayload {
  deviceId: string;
  metrics: {
    cpu?: number;
    memory?: number;
    disk?: number;
    network?: number;
  };
  timestamp: string;
}

// 장비 상태 메시지
export interface DeviceStatusPayload {
  deviceId: string;
  status: 'online' | 'offline' | 'error' | 'maintenance';
  lastHeartbeat?: string;
  errors?: string[];
}

// 워크플로우 진행 상황
export interface WorkflowProgressPayload {
  workflowId: string;
  executionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  currentStep?: string;
  totalSteps?: number;
  completedSteps?: number;
  result?: Record<string, unknown>;
}
// 채팅 응답 메시지
export interface ChatResponsePayload {
  sessionId: string;
  messageId: string;
  content: string;
  type: 'text' | 'code' | 'result' | 'error';
  isStreaming?: boolean;
  isComplete?: boolean;
}

// 알림 메시지
export interface AlertPayload {
  alertId: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  source?: string;
  actionRequired?: boolean;
}

// 에러 메시지
export interface ErrorPayload {
  errorId: string;
  code?: string;
  message: string;
  details?: Record<string, unknown>;
  source?: string;
}

// 하트비트 메시지
export interface HeartbeatPayload {
  timestamp: string;
  serverId?: string;
}

// 연결 상태 메시지
export interface ConnectionStatusPayload {
  status: 'connected' | 'disconnected' | 'reconnecting' | 'error';
  reason?: string;
  retryCount?: number;
  nextRetryIn?: number; // seconds
}
// 타입 안전한 메시지 생성을 위한 헬퍼 타입
export type TypedWebSocketMessage<T extends WebSocketMessageType> = 
  T extends 'execution_update' ? WebSocketMessage & { payload: ExecutionUpdatePayload } :
  T extends 'metric_update' ? WebSocketMessage & { payload: MetricUpdatePayload } :
  T extends 'device_status' ? WebSocketMessage & { payload: DeviceStatusPayload } :
  T extends 'workflow_progress' ? WebSocketMessage & { payload: WorkflowProgressPayload } :
  T extends 'chat_response' ? WebSocketMessage & { payload: ChatResponsePayload } :
  T extends 'alert' ? WebSocketMessage & { payload: AlertPayload } :
  T extends 'error' ? WebSocketMessage & { payload: ErrorPayload } :
  T extends 'heartbeat' ? WebSocketMessage & { payload: HeartbeatPayload } :
  T extends 'connection_status' ? WebSocketMessage & { payload: ConnectionStatusPayload } :
  WebSocketMessage;

// WebSocket 연결 상태
export interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  retryCount: number;
  lastHeartbeat: string | null;
}

// WebSocket 관리를 위한 인터페이스
export interface WebSocketManager {
  connect: () => void;
  disconnect: () => void;
  send: <T extends WebSocketMessageType>(message: TypedWebSocketMessage<T>) => void;
  subscribe: <T extends WebSocketMessageType>(
    type: T, 
    handler: (message: TypedWebSocketMessage<T>) => void
  ) => () => void;
  getState: () => WebSocketState;
}