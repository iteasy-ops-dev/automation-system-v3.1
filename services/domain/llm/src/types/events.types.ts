// LLM Events 타입 정의 - llm-events.json 스키마 100% 준수

export type LLMEventType =
  | 'LLMRequestStarted'
  | 'LLMRequestCompleted'
  | 'LLMRequestFailed'
  | 'TokenLimitExceeded'
  | 'ModelSwitched'
  | 'ProviderHealthCheck'
  | 'CacheHit'
  | 'CacheMiss';

export type LLMProvider = 'openai' | 'anthropic' | 'google' | 'azure';

export interface LLMEventPayload {
  provider?: LLMProvider;
  model?: string;
  requestType?: 'chat' | 'completion' | 'embedding';
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost?: number;
  };
  duration?: number;
  finishReason?: 'stop' | 'length' | 'content_filter' | 'tool_calls';
  error?: string;
  errorCode?: string;
  httpStatus?: number;
  // 추가 필드들은 이벤트 타입에 따라 다름
  [key: string]: any;
}

export interface LLMEventMetadata {
  userId?: string;
  sessionId?: string;
  correlationId?: string;
  workflowExecutionId?: string;
  source?: string;
  version?: string;
  tags?: string[];
  context?: {
    purpose?: 'intent_analysis' | 'summary_generation' | 'text_completion' | 'translation';
    priority?: 'low' | 'normal' | 'high' | 'urgent';
  };
}

export interface LLMEvent {
  eventId: string;
  eventType: LLMEventType;
  timestamp: string;
  requestId?: string;
  payload?: LLMEventPayload;
  metadata?: LLMEventMetadata;
}

// 내부 서비스 타입들
export interface LLMProviderConfig {
  id: string;
  name: string;
  provider_type: LLMProvider;
  api_endpoint?: string;
  api_key_hash?: string;
  models: string[];
  rate_limits: Record<string, any>;
  status: 'active' | 'inactive' | 'error';
  created_at: Date;
  updated_at: Date;
}

export interface CacheEntry {
  key: string;
  value: any;
  ttl: number;
  similarity?: number;
  createdAt: Date;
}
