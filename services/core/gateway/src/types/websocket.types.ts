/**
 * WebSocket Types
 * 
 * WebSocket 관련 타입 정의
 * 계약: shared/contracts/v1.0/events/websocket-messages.json
 */

import { Socket } from 'socket.io';

/**
 * WebSocket 메시지 타입
 */
export enum WebSocketMessageType {
  EXECUTION_UPDATE = 'execution_update',
  METRIC_UPDATE = 'metric_update',
  DEVICE_STATUS = 'device_status',
  WORKFLOW_PROGRESS = 'workflow_progress',
  CHAT_RESPONSE = 'chat_response',
  ALERT = 'alert',
  ERROR = 'error',
  HEARTBEAT = 'heartbeat',
  CONNECTION_STATUS = 'connection_status'
}

/**
 * WebSocket 메시지 우선순위
 */
export enum MessagePriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}

/**
 * 메시지 메타데이터
 */
export interface MessageMetadata {
  messageId: string;
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  priority?: MessagePriority;
  ttl?: number;
  version?: string;
}

/**
 * 기본 WebSocket 메시지 구조
 */
export interface WebSocketMessage<T = any> {
  type: WebSocketMessageType;
  timestamp: string;
  payload: T;
  metadata?: MessageMetadata;
}

/**
 * 실행 업데이트 페이로드
 */
export interface ExecutionUpdatePayload {
  executionId: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress?: number;
  currentStep?: {
    stepId: string;
    stepName: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
  };
  result?: any;
  error?: string;
  estimatedTimeRemaining?: number;
}

/**
 * 메트릭 업데이트 페이로드
 */
export interface MetricUpdatePayload {
  deviceId: string;
  deviceName: string;
  metrics: {
    cpu?: number;
    memory?: number;
    disk?: number;
    network?: {
      rxBytes: number;
      txBytes: number;
    };
    temperature?: number;
  };
  thresholds?: {
    cpu?: number;
    memory?: number;
    disk?: number;
  };
  alerts?: Array<{
    metric: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
  }>;
}

/**
 * 장비 상태 페이로드
 */
export interface DeviceStatusPayload {
  deviceId: string;
  deviceName: string;
  previousStatus: 'online' | 'offline' | 'error' | 'maintenance';
  currentStatus: 'online' | 'offline' | 'error' | 'maintenance';
  reason?: string;
  lastHeartbeat?: string;
  uptime?: number;
}

/**
 * 워크플로우 진행 페이로드
 */
export interface WorkflowProgressPayload {
  executionId: string;
  workflowId: string;
  workflowName: string;
  stepUpdate: {
    stepId: string;
    stepName: string;
    status: 'started' | 'completed' | 'failed';
    progress?: number;
    result?: any;
    output?: string;
    error?: string;
  };
  overallProgress?: number;
}

/**
 * 채팅 응답 페이로드
 */
export interface ChatResponsePayload {
  sessionId: string;
  messageId: string;
  content?: string;
  streaming?: boolean;
  chunk?: string;
  finished?: boolean;
  metadata?: {
    model?: string;
    tokenUsage?: {
      totalTokens: number;
      cost: number;
    };
  };
}

/**
 * 알림 페이로드
 */
export interface AlertPayload {
  alertId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'system' | 'security' | 'performance' | 'availability';
  title: string;
  message: string;
  source?: {
    type: 'device' | 'workflow' | 'system';
    id: string;
    name: string;
  };
  actions?: Array<{
    id: string;
    label: string;
    type: 'acknowledge' | 'resolve' | 'escalate' | 'execute';
  }>;
}

/**
 * 에러 페이로드
 */
export interface ErrorPayload {
  errorId: string;
  errorCode?: string;
  message: string;
  details?: any;
  context?: {
    executionId?: string;
    stepId?: string;
    deviceId?: string;
  };
  recoverable?: boolean;
  retryable?: boolean;
}

/**
 * 하트비트 페이로드
 */
export interface HeartbeatPayload {
  serverTime: string;
  connectionId?: string;
  activeConnections?: number;
  systemStatus?: 'healthy' | 'degraded' | 'maintenance';
}

/**
 * 인증된 소켓
 */
export interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
  sessionId?: string;
}

/**
 * WebSocket 이벤트
 */
export enum WebSocketEvent {
  CONNECTION = 'connection',
  DISCONNECT = 'disconnect',
  ERROR = 'error',
  SUBSCRIBE = 'subscribe',
  UNSUBSCRIBE = 'unsubscribe',
  MESSAGE = 'message',
  BROADCAST = 'broadcast'
}

/**
 * 구독 옵션
 */
export interface SubscriptionOptions {
  topics?: string[];
  filters?: {
    deviceIds?: string[];
    workflowIds?: string[];
    severity?: string[];
  };
}
