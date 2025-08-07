/**
 * LLM Service - Frontend API 통신
 * 이원화된 LLM 관리를 위한 서비스
 */

import { apiClient } from './api';
import {
  LLMProvider,
  LLMModel,
  CreateProviderDto,
  UpdateProviderDto,
  TestResult,
  UsageStats,
  LLMPurpose
} from '@/types/llm';

class LLMService {
  private baseURL = '/api/v1/llm';

  // 프로바이더 관리
  async getProviders(): Promise<LLMProvider[]> {
    return apiClient.get(`${this.baseURL}/providers`);
  }

  async getProvider(id: string): Promise<LLMProvider> {
    return apiClient.get(`${this.baseURL}/providers/${id}`);
  }

  async createProvider(provider: CreateProviderDto): Promise<LLMProvider> {
    return apiClient.post(`${this.baseURL}/providers`, provider);
  }

  async updateProvider(id: string, updates: UpdateProviderDto): Promise<LLMProvider> {
    return apiClient.put(`${this.baseURL}/providers/${id}`, updates);
  }

  async deleteProvider(id: string): Promise<void> {
    return apiClient.delete(`${this.baseURL}/providers/${id}`);
  }

  // 모델 관리
  async getModels(providerId?: string): Promise<LLMModel[]> {
    return apiClient.get(`${this.baseURL}/models`, providerId ? { providerId } : undefined);
  }

  async discoverModels(providerId: string): Promise<LLMModel[]> {
    return apiClient.post(`${this.baseURL}/discover`, { providerId });
  }

  // 설정 관리
  async setDefaultProvider(purpose: LLMPurpose, providerId: string): Promise<void> {
    return apiClient.post(`${this.baseURL}/providers/${providerId}/set-default`, { purpose });
  }

  async testProvider(providerId: string): Promise<TestResult> {
    return apiClient.post(`${this.baseURL}/test`, { providerId });
  }

  // 사용량 모니터링
  async getUsage(providerId?: string, days: number = 30): Promise<UsageStats> {
    return apiClient.get(`${this.baseURL}/usage`, { providerId, days });
  }

  // Chat/Workflow 완성 API
  async chatCompletion(messages: any[], providerId?: string): Promise<any> {
    return apiClient.post(`${this.baseURL}/chat/completions`, {
      messages,
      providerId
    });
  }

  async workflowCompletion(prompt: string, providerId?: string): Promise<any> {
    return apiClient.post(`${this.baseURL}/workflow/completions`, {
      prompt,
      providerId
    });
  }
}

export const llmService = new LLMService();
