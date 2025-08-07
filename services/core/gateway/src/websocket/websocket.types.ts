/**
 * WebSocket Types based on websocket-messages.json contract
 */

export type MessageType = 
  | 'execution_update'
  | 'metric_update'
  | 'device_status'
  | 'workflow_progress'
  | 'chat_response'
  | 'alert'
  | 'error'
  | 'heartbeat'
  | 'connection_status'
  | 'pong';  // ping/pong 지원 추가

export interface WebSocketMessage {
  type: MessageType;
  timestamp: string;
  payload: any;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  messageId: string;
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  ttl?: number;
  version: string;
}

export interface ConnectionMetadata {
  userId: string;
  sessionId: string;
  connectedAt: Date;
  lastActivity: Date;
}

// Payload interfaces for each message type
export interface ExecutionUpdatePayload {
  executionId: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  currentStep?: {
    stepId: string;
    stepName: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
  };
  result?: any;
  error?: string;
  estimatedTimeRemaining?: number;
}

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

export interface DeviceStatusPayload {
  deviceId: string;
  deviceName: string;
  previousStatus: 'online' | 'offline' | 'error' | 'maintenance';
  currentStatus: 'online' | 'offline' | 'error' | 'maintenance';
  reason?: string;
  lastHeartbeat?: string;
  uptime?: number;
}

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
  overallProgress: number;
}

export interface ChatResponsePayload {
  sessionId: string;
  messageId: string;
  content?: string;
  streaming: boolean;
  chunk?: string;
  finished: boolean;
  metadata?: {
    model?: string;
    tokenUsage?: {
      totalTokens: number;
      cost: number;
    };
  };
}

export interface AlertPayload {
  alertId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'system' | 'security' | 'performance' | 'availability';
  title: string;
  message: string;
  source: {
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
  recoverable: boolean;
  retryable: boolean;
}

export interface HeartbeatPayload {
  serverTime: string;
  connectionId?: string;
  activeConnections: number;
  systemStatus: 'healthy' | 'degraded' | 'maintenance';
}

export interface ConnectionStatusPayload {
  status: 'connected' | 'disconnected' | 'reconnecting';
  sessionId?: string;
  serverTime?: string;
}
