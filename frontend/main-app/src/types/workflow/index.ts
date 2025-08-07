/**
 * Workflow Types
 * 
 * TASK-2 계약 100% 준수: shared/contracts/v1.0/rest/domain/workflow-service.yaml
 */

// Chat Workflow Types
export interface ChatWorkflowRequest {
  sessionId: string; // UUID format
  message: string; // minLength: 1, maxLength: 2000
  context?: Record<string, unknown>;
  options?: {
    async?: boolean; // default: true
    timeout?: number; // min: 30, max: 3600, default: 300
    dryRun?: boolean; // default: false
  };
}

export interface ChatWorkflowResponse {
  executionId: string; // UUID format
  workflowId: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  message?: string; // 🔥 AI 응답 메시지 (simple_response인 경우)
  type?: string; // 응답 타입 (simple_response 등)
  duration?: number; // 실행 시간 (milliseconds)
  intent: WorkflowIntent;
  estimatedDuration?: number; // seconds
  steps?: WorkflowStepSummary[];
  startedAt?: string; // ISO date-time
}

export interface WorkflowIntent {
  action: string;
  target: string;
  parameters?: Record<string, unknown>;
  confidence?: number; // 0-1 range
}

export interface WorkflowStepSummary {
  stepId: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  estimatedDuration?: number; // seconds
}

// Workflow Execution Types
export interface WorkflowExecutionStatus {
  executionId: string; // UUID format
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  sessionId?: string; // UUID format
  startedAt: string; // ISO date-time
  completedAt?: string; // ISO date-time
  duration?: number; // milliseconds
  progress?: number; // 0-100
  result?: Record<string, unknown>;
  error?: string;
  steps: WorkflowStep[];
  metadata?: Record<string, unknown>;
  logs?: WorkflowLog[];
}

export interface WorkflowStep {
  stepId: string;
  name: string;
  description?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: string; // ISO date-time
  completedAt?: string; // ISO date-time
  duration?: number; // milliseconds
  progress?: number; // 0-100
  result?: Record<string, unknown>;
  error?: string;
  retryCount?: number;
  dependencies?: string[];
}

export interface WorkflowLog {
  timestamp: string; // ISO date-time
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  stepId?: string;
  details?: Record<string, unknown>;
}

// Error Response (from API contract)
export interface WorkflowErrorResponse {
  error: string;
  message: string;
  timestamp: string; // ISO date-time
  details?: Record<string, unknown>;
}

// Chat Session Types (for local state management)
export interface ChatSession {
  sessionId: string; // UUID
  userId: string;
  status: 'active' | 'completed' | 'aborted';
  context?: Record<string, unknown>;
  messages: ChatMessage[];
  createdAt: string; // ISO date-time
  updatedAt: string; // ISO date-time
  completedAt?: string; // ISO date-time
}

export interface ChatMessage {
  messageId: string; // UUID
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string; // ISO date-time
  metadata?: {
    executionId?: string;
    workflowId?: string;
    model?: string;
    tokenUsage?: {
      totalTokens: number;
      cost: number;
    };
    streaming?: boolean;
    finished?: boolean;
  };
}

// Workflow Progress Update (from WebSocket)
export interface WorkflowProgressUpdate {
  executionId: string;
  workflowId: string;
  workflowName?: string;
  stepUpdate?: {
    stepId: string;
    stepName: string;
    status: 'started' | 'completed' | 'failed';
    progress?: number; // 0-100
    result?: Record<string, unknown>;
    output?: string;
    error?: string;
  };
  overallProgress?: number; // 0-100
}

// Chat Response (from WebSocket)
export interface ChatResponseUpdate {
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
