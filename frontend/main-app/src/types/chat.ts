/**
 * Chat Types
 * 
 * Chat UI 관련 타입 정의
 */

// UI State Types
export interface ChatUIState {
  sessionId: string | null;
  messages: ChatUIMessage[];
  currentExecution: ExecutionProgress | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  inputText: string;
  isTyping: boolean;
}

export interface ChatUIMessage {
  id: string; // messageId
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  status: 'sending' | 'sent' | 'received' | 'error';
  metadata?: {
    executionId?: string;
    workflowId?: string;
    workflowName?: string;
    streaming?: boolean;
    finished?: boolean;
    type?: string; // 🔥 응답 타입 (simple_response 등)
    intent?: any; // 🔥 워크플로우 의도
    duration?: number; // 🔥 실행 시간
    error?: string; // 🔥 에러 정보
    tokenUsage?: {
      totalTokens: number;
      cost: number;
    };
  };
  error?: string;
}

export interface ExecutionProgress {
  executionId: string;
  workflowId: string;
  workflowName?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  overallProgress: number; // 0-100
  currentStep?: {
    stepId: string;
    stepName: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress?: number;
  };
  steps: StepProgress[];
  startedAt: Date;
  finishedAt?: Date;
  estimatedTimeRemaining?: number; // seconds
  error?: string;
}

export interface StepProgress {
  stepId: string;
  stepName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  progress?: number; // 0-100
  result?: Record<string, unknown>;
  output?: string;
  error?: string;
  duration?: number; // milliseconds
}

// File Upload Types
export interface FileUpload {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  progress: number; // 0-100
  url?: string;
  error?: string;
}

// Chat Actions
export type ChatAction = 
  | { type: 'SET_SESSION_ID'; payload: string }
  | { type: 'ADD_MESSAGE'; payload: ChatUIMessage }
  | { type: 'UPDATE_MESSAGE'; payload: { id: string; updates: Partial<ChatUIMessage> } }
  | { type: 'SET_INPUT_TEXT'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_TYPING'; payload: boolean }
  | { type: 'SET_CONNECTION_STATUS'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_EXECUTION'; payload: ExecutionProgress | null }
  | { type: 'UPDATE_EXECUTION'; payload: Partial<ExecutionProgress> }
  | { type: 'UPDATE_STEP'; payload: { stepId: string; updates: Partial<StepProgress> } }
  | { type: 'CLEAR_MESSAGES' }
  | { type: 'RESET_CHAT' };

// Component Props
export interface ChatContainerProps {
  className?: string;
}

export interface MessageListProps {
  messages: ChatUIMessage[];
  currentExecution: ExecutionProgress | null;
  isTyping: boolean;
  className?: string;
}

export interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (message: string) => void;
  onFileUpload?: (files: File[]) => void;
  isLoading: boolean;
  isConnected: boolean;
  className?: string;
}

export interface WorkflowProgressProps {
  execution: ExecutionProgress;
  onCancel?: () => void;
  className?: string;
}

export interface FileUploadProps {
  files: FileUpload[];
  onUpload: (files: File[]) => void;
  onRemove: (fileId: string) => void;
  maxFiles?: number;
  maxSize?: number; // bytes
  acceptedTypes?: string[];
  className?: string;
}

// Utility Types
export interface ChatConfig {
  wsUrl: string;
  apiUrl: string;
  maxMessageLength: number;
  maxFileSize: number;
  allowedFileTypes: string[];
  reconnectInterval: number;
  heartbeatInterval: number;
}

export interface ChatTheme {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  error: string;
  success: string;
  warning: string;
}
