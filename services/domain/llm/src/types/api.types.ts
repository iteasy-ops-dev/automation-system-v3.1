// LLM Service 타입 정의 - 계약 기반 (llm-service.yaml 100% 준수)

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
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

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost?: number;
}

export interface ChatChoice {
  message: ChatMessage;
  finishReason?: 'stop' | 'length' | 'content_filter';
  index?: number;
}

export interface ChatResponse {
  id: string;
  model: string;
  usage: TokenUsage;
  choices: ChatChoice[];
  createdAt?: string;
  finishReason?: 'stop' | 'length' | 'content_filter' | 'tool_calls';
}

export interface StreamChatRequest extends ChatRequest {
  stream: true;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'google' | 'azure';
  capabilities: ('chat' | 'completion' | 'embedding' | 'image')[];
  contextWindow: number;
  costPer1kTokens: {
    input: number;
    output: number;
  };
  status: 'active' | 'maintenance' | 'deprecated';
  description?: string;
  version?: string;
}

export interface ModelsResponse {
  models: ModelInfo[];
  lastUpdated?: string;
}
