/**
 * LLM Types - 이원화된 LLM 관리 시스템
 * v3.1 아키텍처에 따른 Chat/Workflow 분리 관리
 */

export type LLMProviderType = 'openai' | 'anthropic' | 'google' | 'ollama' | 'custom';
export type LLMPurpose = 'chat' | 'workflow' | 'both';

export interface LLMProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  apiVersion?: string;
  organization?: string;
  // 프라이빗 LLM 추가 설정
  authType?: 'bearer' | 'basic' | 'custom' | 'none';
  customHeaders?: Record<string, string>;
  timeout?: number;
}

export interface LLMProvider {
  id: string;
  name: string;
  type: LLMProviderType;
  purpose: LLMPurpose; // 이원화 구분
  config: LLMProviderConfig;
  models: string[];  // 백엔드와 일치하도록 문자열 배열로 변경
  isActive: boolean;
  isDefault: {
    forChat: boolean;
    forWorkflow: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface LLMModel {
  id: string;
  name: string;
  displayName?: string;
  maxTokens: number;
  supportsFunctions: boolean;
  supportsStreaming: boolean;
  costPer1kTokens?: {
    input: number;
    output: number;
  };
}

export interface CreateProviderDto {
  name: string;
  type: LLMProviderType;
  purpose: LLMPurpose;
  config: LLMProviderConfig;
  models?: string[]; // 모델 ID 목록
}

export interface UpdateProviderDto {
  name?: string;
  purpose?: LLMPurpose;
  config?: Partial<LLMProviderConfig>;
  models?: string[];  // models 추가!
  isActive?: boolean;
  isDefault?: Partial<LLMProvider['isDefault']>;
}

export interface TestResult {
  success: boolean;
  message: string;
  latency?: number;
  error?: string;
}

export interface UsageStats {
  providerId: string;
  providerName: string;
  totalTokens: number;
  totalCost: number;
  requestCount: number;
  period: {
    start: string;
    end: string;
  };
  breakdown?: {
    date: string;
    tokens: number;
    cost: number;
    requests: number;
  }[];
}

// Provider 설정 템플릿
export const providerConfigs: Record<LLMProviderType, {
  fields: string[];
  baseUrl?: string;
  defaultModels?: string[];
  requiresModelDiscovery?: boolean;
}> = {
  openai: {
    fields: ['apiKey', 'organization'],
    baseUrl: 'https://api.openai.com/v1',
    defaultModels: ['gpt-4', 'gpt-4-turbo-preview', 'gpt-3.5-turbo', 'gpt-3.5-turbo-16k']
  },
  anthropic: {
    fields: ['apiKey'],
    baseUrl: 'https://api.anthropic.com',
    defaultModels: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307']
  },
  google: {
    fields: ['apiKey'],
    baseUrl: 'https://generativelanguage.googleapis.com/v1',
    defaultModels: ['gemini-pro', 'gemini-pro-vision']
  },
  ollama: {
    fields: ['baseUrl'],
    baseUrl: 'http://localhost:11434',
    requiresModelDiscovery: true
  },
  custom: {
    fields: ['baseUrl', 'apiKey', 'authType', 'customHeaders'],
    requiresModelDiscovery: true
  }
};
