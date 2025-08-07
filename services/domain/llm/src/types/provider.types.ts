/**
 * LLM Provider Types - 이원화된 관리를 위한 타입 정의
 */

export type LLMProviderType = 'openai' | 'anthropic' | 'google' | 'azure' | 'ollama' | 'custom';
export type LLMPurpose = 'chat' | 'workflow' | 'both';

export interface LLMProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  apiVersion?: string;
  organization?: string;
  authType?: 'bearer' | 'basic' | 'custom' | 'none';
  customHeaders?: Record<string, string>;
  headers?: Record<string, string>; // Custom provider용
  testEndpoint?: string; // Custom provider용
  timeout?: number;
}

export interface LLMProvider {
  id: string;
  name: string;
  type: LLMProviderType;
  purpose: LLMPurpose;
  config: LLMProviderConfig;
  models: string[];
  isActive: boolean;
  isDefault: {
    forChat: boolean;
    forWorkflow: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProviderDto {
  name: string;
  type: LLMProviderType;
  purpose: LLMPurpose;
  config: LLMProviderConfig;
  models?: string[];
}

export interface UpdateProviderDto {
  name?: string;
  purpose?: LLMPurpose;
  config?: Partial<LLMProviderConfig>;
  models?: string[];
  isActive?: boolean;
  isDefault?: Partial<LLMProvider['isDefault']>;
}

export interface TestProviderResult {
  success: boolean;
  message: string;
  latency?: number;
  error?: string;
  metadata?: any; // 추가 메타데이터
}
