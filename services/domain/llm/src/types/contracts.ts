/**
 * LLM Service Types - 계약 기반 타입 정의
 * 기반: shared/contracts/v1.0/rest/domain/llm-service.yaml
 */

// ===== 기본 타입 정의 =====

export type LLMProvider = 'openai' | 'anthropic' | 'google' | 'azure' | 'ollama';
export type ModelCapability = 'chat' | 'completion' | 'embedding' | 'image';
export type ModelStatus = 'active' | 'maintenance' | 'deprecated';
export type MessageRole = 'system' | 'user' | 'assistant';
export type FinishReason = 'stop' | 'length' | 'content_filter' | 'tool_calls';
export type UsageGroupBy = 'provider' | 'model' | 'user' | 'hour' | 'day';

// ===== 메시지 및 채팅 =====

export interface ChatMessage {
  role: MessageRole;
  content: string;
  name?: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  metadata?: Record<string, any>;
}

export interface StreamChatRequest extends ChatRequest {
  stream: true;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost?: number;
}

export interface ChatChoice {
  message: ChatMessage;
  finishReason?: FinishReason;
  index?: number;
}

export interface ChatResponse {
  id: string;
  model: string;
  usage: TokenUsage;
  choices: ChatChoice[];
  createdAt?: string;
  finishReason?: FinishReason;
}

// ===== 모델 정보 =====

export interface ModelInfo {
  id: string;
  name: string;
  provider: LLMProvider;
  capabilities: ModelCapability[];
  contextWindow?: number;
  costPer1kTokens?: {
    input: number;
    output: number;
  };
  status: ModelStatus;
  description?: string;
  version?: string;
}

export interface ModelsResponse {
  models: ModelInfo[];
  lastUpdated?: string;
}

// ===== 사용량 추적 =====

export interface UsageBreakdown {
  provider: string;
  model: string;
  requests: number;
  tokens: {
    input: number;
    output: number;
  };
  cost: number;
  avgResponseTime?: number;
}

export interface UsageResponse {
  period: {
    start: string;
    end: string;
  };
  summary: {
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    avgResponseTime?: number;
  };
  breakdown: UsageBreakdown[];
}

// ===== 템플릿 관리 =====

export interface Template {
  id: string;
  name: string;
  category: string;
  template: string;
  variables?: string[];
  description?: string;
  model?: string;
  parameters?: Record<string, any>;
  examples?: Record<string, any>[];
  createdAt: string;
  updatedAt?: string;
}

export interface TemplateCreate {
  name: string;
  category: string;
  template: string;
  description?: string;
  model?: string;
  parameters?: Record<string, any>;
  examples?: Record<string, any>[];
}

export interface TemplatesResponse {
  items: Template[];
  total: number;
  limit: number;
  offset: number;
}

// ===== 에러 응답 =====

export interface ErrorResponse {
  error: string;
  message: string;
  timestamp: string;
  details?: Record<string, any>;
}

// ===== 내부 도메인 타입 =====

export interface LLMProviderConfig {
  id: string;
  name: string;
  providerType: LLMProvider;
  apiEndpoint?: string;
  apiKeyHash?: string;
  models: ModelInfo[];
  rateLimits: RateLimit;
  config: Record<string, any>;
  status: 'active' | 'inactive' | 'error';
  healthCheckUrl?: string;
  lastHealthCheck?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface RateLimit {
  requestsPerMinute?: number;
  tokensPerMinute?: number;
  tokensPerHour?: number;
  tokensPerDay?: number;
  concurrent?: number;
}

export interface CacheConfig {
  ttl: number;
  maxSize: number;
  similarityThreshold: number;
}

export interface PromptTemplate {
  templateId: string;
  name: string;
  content: string;
  category: string;
  variables: TemplateVariable[];
  version: string;
  isActive: boolean;
  usageCount: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required?: boolean;
  defaultValue?: any;
  description?: string;
}

export interface LLMUsageLog {
  id: string;
  requestId: string;
  userId?: string;
  providerId: string;
  modelName: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  duration?: number;
  status: 'success' | 'error' | 'timeout';
  errorMessage?: string;
  cached: boolean;
  templateId?: string;
  createdAt: Date;
}

export interface LLMRequestLog {
  requestId: string;
  timestamp: Date;
  provider: LLMProvider;
  providerId?: string;
  model: string;
  messages: ChatMessage[];
  response?: {
    content: string;
    finishReason: string;
    tokenUsage: TokenUsage;
  };
  templateUsed?: string;
  cached: boolean;
  duration?: number;
  status: 'success' | 'error' | 'timeout';
  error?: {
    code: string;
    message: string;
    type: string;
  };
}

// ===== 이벤트 타입 (Kafka) =====

export type LLMEventType = 
  | 'LLMRequestStarted'
  | 'LLMRequestCompleted' 
  | 'LLMRequestFailed'
  | 'TokenLimitExceeded'
  | 'ModelSwitched'
  | 'ProviderHealthCheck'
  | 'CacheHit'
  | 'CacheMiss';

export interface LLMEvent {
  eventId: string;
  eventType: LLMEventType;
  timestamp: string;
  requestId?: string;
  payload: Record<string, any>;
  metadata?: {
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
  };
}

// ===== 서비스 설정 =====

export interface LLMServiceConfig {
  port: number;
  providers: LLMProviderConfig[];
  cache: CacheConfig;
  logging: {
    level: string;
    format: string;
  };
  databases: {
    postgres: {
      host: string;
      port: number;
      database: string;
      username: string;
      password: string;
    };
    mongodb: {
      url: string;
      database: string;
    };
    redis: {
      host: string;
      port: number;
      password?: string;
      db: number;
    };
  };
  kafka: {
    brokers: string[];
    clientId: string;
    groupId: string;
  };
}

// ===== 헬스체크 =====

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    postgres: ServiceStatus;
    mongodb: ServiceStatus;
    redis: ServiceStatus;
    kafka: ServiceStatus;
  };
  providers: {
    available: string[];
    count: number;
  };
}

export interface ServiceStatus {
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  error?: string;
  lastCheck: string;
}
