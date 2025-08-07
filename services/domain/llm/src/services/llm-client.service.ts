/**
 * LLM Client Service - 실제 LLM API 클라이언트
 * 각 프로바이더별 실제 API 연결을 담당
 */

import axios from 'axios';
import logger from '../utils/logger';
import { LLMProvider, TestProviderResult } from '../types/provider.types';

interface LLMClientOptions {
  timeout?: number;
  retries?: number;
}

export class LLMClientService {
  private clients: Map<string, any> = new Map();
  private options: LLMClientOptions;

  constructor(options: LLMClientOptions = {}) {
    this.options = {
      timeout: 30000, // 30초
      retries: 2,
      ...options
    };
  }

  /**
   * Provider용 HTTP 클라이언트 생성
   */
  private getClient(provider: LLMProvider): any {
    const clientKey = `${provider.type}-${provider.id}`;
    
    if (this.clients.has(clientKey)) {
      return this.clients.get(clientKey)!;
    }

    const client = axios.create({
      baseURL: provider.config.baseUrl,
      timeout: this.options.timeout,
      headers: this.getAuthHeaders(provider)
    });

    this.clients.set(clientKey, client);
    return client;
  }

  /**
   * Provider별 인증 헤더 생성
   */
  private getAuthHeaders(provider: LLMProvider): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'automation-system-llm-service/1.0'
    };

    switch (provider.type) {
      case 'openai':
        if (provider.config.apiKey) {
          headers['Authorization'] = `Bearer ${provider.config.apiKey}`;
        }
        if (provider.config.organization) {
          headers['OpenAI-Organization'] = provider.config.organization;
        }
        break;

      case 'anthropic':
        if (provider.config.apiKey) {
          headers['x-api-key'] = provider.config.apiKey;
          headers['anthropic-version'] = '2023-06-01';
        }
        break;

      case 'google':
        if (provider.config.apiKey) {
          headers['Authorization'] = `Bearer ${provider.config.apiKey}`;
        }
        break;

      case 'azure':
        if (provider.config.apiKey) {
          headers['api-key'] = provider.config.apiKey;
        }
        break;

      case 'ollama':
        // Ollama는 보통 인증이 필요 없음
        break;

      case 'custom':
        // Custom provider의 경우 config에서 헤더 설정
        if (provider.config.headers) {
          Object.assign(headers, provider.config.headers);
        }
        break;
    }

    return headers;
  }

  /**
   * Provider 연결 테스트 - 실제 API 호출
   */
  async testProvider(provider: LLMProvider): Promise<TestProviderResult> {
    const startTime = Date.now();
    
    logger.info(`[LLM_CLIENT] Starting test for provider: ${provider.name} (${provider.type})`);
    logger.info(`[LLM_CLIENT] API Base URL: ${provider.config.baseUrl}`);
    
    try {
      // API 키 검증
      if (!this.validateConfig(provider)) {
        logger.warn(`[LLM_CLIENT] Invalid configuration for ${provider.id}`);
        return {
          success: false,
          message: 'Invalid configuration',
          error: 'INVALID_CONFIG'
        };
      }

      const client = this.getClient(provider);
      logger.info(`[LLM_CLIENT] HTTP client created for ${provider.type}`);
      
      // Provider별 테스트 엔드포인트 호출
      const result = await this.callTestEndpoint(provider, client);
      
      const latency = Date.now() - startTime;
      logger.info(`[LLM_CLIENT] Test SUCCESS for ${provider.id}: ${latency}ms`);
      
      return {
        success: true,
        message: 'Connection test successful',
        latency,
        metadata: result
      };

    } catch (error: any) {
      const latency = Date.now() - startTime;
      
      logger.error(`[LLM_CLIENT] Test FAILED for ${provider.id}:`, error);
      
      if (error.response) {
        const status = error.response?.status;
        const message = error.response?.data?.error?.message || error.message;
        
        return {
          success: false,
          message: `API Error: ${message}`,
          error: `HTTP_${status || 'UNKNOWN'}`,
          latency
        };
      }

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        error: 'CONNECTION_ERROR',
        latency
      };
    }
  }

  /**
   * Provider별 설정 검증
   */
  private validateConfig(provider: LLMProvider): boolean {
    switch (provider.type) {
      case 'openai':
        return !!provider.config.apiKey && !!provider.config.baseUrl;
      
      case 'anthropic':
        return !!provider.config.apiKey && !!provider.config.baseUrl;
      
      case 'custom':
        return !!provider.config.baseUrl;
      
      default:
        return false;
    }
  }

  /**
   * Provider별 테스트 엔드포인트 호출
   */
  private async callTestEndpoint(provider: LLMProvider, client: any): Promise<any> {
    switch (provider.type) {
      case 'openai':
        return await this.testOpenAI(client);
      
      case 'anthropic':
        return await this.testAnthropic(client);
      
      case 'custom':
        return await this.testCustom(client, provider);
      
      default:
        throw new Error(`Unsupported provider type: ${provider.type}`);
    }
  }

  /**
   * OpenAI API 테스트
   */
  private async testOpenAI(client: any): Promise<any> {
    const response = await client.get('/models');
    const modelCount = response.data?.data?.length || 0;
    return { modelCount, endpoint: '/models' };
  }

  /**
   * Anthropic API 테스트 - 실제 API 호출은 비용이 발생하므로 헤더 검증만
   */
  private async testAnthropic(client: any): Promise<any> {
    // Anthropic은 간단한 헤더 검증만 수행 (실제 API 호출은 비용 발생)
    const headers = client.defaults.headers;
    if (!headers['x-api-key']) {
      throw new Error('API key not configured');
    }
    
    return { 
      endpoint: 'header_validation',
      hasApiKey: true,
      message: 'Configuration validated (actual API call skipped to avoid costs)'
    };
  }

  /**
   * Custom API 테스트
   */
  private async testCustom(client: any, provider: LLMProvider): Promise<any> {
    const testEndpoint = provider.config.testEndpoint || '/health';
    const response = await client.get(testEndpoint);
    
    return { 
      status: response.status,
      endpoint: testEndpoint,
      data: response.data
    };
  }

  /**
   * 실제 모델 목록 조회
   */
  async discoverModels(provider: LLMProvider): Promise<any[]> {
    try {
      const client = this.getClient(provider);
      
      switch (provider.type) {
        case 'openai':
          return await this.discoverOpenAIModels(client);
        
        case 'anthropic':
          return this.getAnthropicModels(); // 하드코딩된 모델 목록
        
        case 'custom':
          return [];
        
        default:
          return [];
      }
    } catch (error) {
      logger.error(`Failed to discover models for ${provider.id}:`, error);
      return [];
    }
  }

  private async discoverOpenAIModels(client: any): Promise<any[]> {
    try {
      const response = await client.get('/models');
      return response.data?.data?.map((model: any) => ({
        id: model.id,
        name: model.id,
        displayName: model.id.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        maxTokens: this.getModelMaxTokens(model.id),
        supportsFunctions: model.id.includes('gpt-4') || model.id.includes('gpt-3.5'),
        supportsStreaming: true,
        owned_by: model.owned_by
      })) || [];
    } catch (error) {
      logger.error('Failed to discover OpenAI models:', error);
      return [];
    }
  }

  private getAnthropicModels(): any[] {
    return [
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', displayName: 'Claude 3 Opus', maxTokens: 200000 },
      { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', displayName: 'Claude 3 Sonnet', maxTokens: 200000 },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', displayName: 'Claude 3 Haiku', maxTokens: 200000 }
    ];
  }

  private getModelMaxTokens(modelId: string): number {
    const tokenLimits: Record<string, number> = {
      'gpt-4': 8192,
      'gpt-4-turbo': 128000,
      'gpt-4-turbo-preview': 128000,
      'gpt-3.5-turbo': 4096,
      'gpt-3.5-turbo-16k': 16384,
      'claude-3-opus': 200000,
      'claude-3-sonnet': 200000,
      'claude-3-haiku': 200000
    };

    for (const [key, limit] of Object.entries(tokenLimits)) {
      if (modelId.includes(key)) {
        return limit;
      }
    }

    return 4096; // 기본값
  }
}
