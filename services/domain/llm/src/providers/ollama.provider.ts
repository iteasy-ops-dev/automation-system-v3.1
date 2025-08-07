/**
 * Ollama Provider Implementation (TASK A 수정 버전)
 * Ollama API를 통한 LLM 요청 처리 - 올바른 모델명 사용
 */

import { v4 as uuidv4 } from 'uuid';
import { BaseLLMProvider } from './base.provider';
import { ChatRequest, ChatResponse, ModelInfo, LLMProvider, ModelCapability } from '../types/contracts';
import { LLMProvider as ProviderType } from '../types/provider.types';
import { finalConfig } from '../config';
import logger from '../utils/logger';

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OllamaChatRequest {
  model: string;
  messages: OllamaMessage[];
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    num_predict?: number;
    stop?: string[];
  };
}

interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export class OllamaProvider extends BaseLLMProvider {
  protected providerType: LLMProvider = 'ollama';
  protected apiKey: string = ''; // Ollama는 API 키가 필요 없음
  private baseUrl: string;

  constructor(config?: ProviderType) {
    super();
    
    if (config?.config?.baseUrl) {
      // 🔥 TASK A 수정: MongoDB에서 가져온 동적 설정 우선 사용
      this.baseUrl = config.config.baseUrl;
      logger.info(`🔥 [TASK-A] Ollama provider using dynamic config: ${this.baseUrl}`);
    } else {
      // 환경변수 기반 폴백 (최후 수단)
      const providerConfig = finalConfig.providers.find(p => p.providerType === 'ollama');
      this.baseUrl = providerConfig?.config?.baseUrl || 'http://localhost:11434';
      logger.warn(`⚠️ [TASK-A] Ollama provider using fallback config: ${this.baseUrl}`);
    }

    logger.info(`✅ [TASK-A] Ollama provider initialized with baseUrl: ${this.baseUrl}`);
  }

  /**
   * 🔥 TASK A 수정: 채팅 요청 처리 - 올바른 모델명 사용
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    this.validateRequest(request);

    try {
      // 🔥 수정: 동적 모델 선택 - 지정된 모델이 없으면 첫 번째 사용 가능한 모델 사용
      let modelToUse = request.model;
      
      if (!modelToUse) {
        try {
          const availableModels = await this.getModels();
          if (availableModels.length > 0) {
            modelToUse = availableModels[0].id;
            logger.info(`🔄 [TASK-A] Auto-selected first available model: ${modelToUse}`);
          } else {
            throw new Error('No models available');
          }
        } catch (error) {
          logger.error('❌ Failed to get available models for auto-selection:', error);
          throw new Error('No model specified and cannot determine available models');
        }
      }
      
      const ollamaRequest: OllamaChatRequest = {
        model: modelToUse,
        messages: request.messages.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        stream: false,
        options: {
          temperature: request.temperature,
          top_p: request.topP,
          num_predict: request.maxTokens,
          stop: request.stop,
        },
      };

      logger.info('🚀 Sending Ollama chat request:', {
        model: ollamaRequest.model,
        messageCount: ollamaRequest.messages.length,
        temperature: ollamaRequest.options?.temperature,
        lastMessage: ollamaRequest.messages.slice(-1)[0]?.content?.substring(0, 50) + '...',
      });

      // Node.js http 모듈 사용
      const response = await this.makeHttpRequest('/api/chat', 'POST', ollamaRequest);
      const ollamaResponse = response as OllamaChatResponse;

      if (!ollamaResponse.message?.content) {
        throw new Error('No response content from Ollama');
      }

      // 토큰 사용량 계산 (Ollama 응답에서 토큰 정보 추출)
      const promptTokens = ollamaResponse.prompt_eval_count || this.estimateTokens(
        request.messages.map(m => m.content).join(' ')
      );
      const completionTokens = ollamaResponse.eval_count || this.estimateTokens(
        ollamaResponse.message.content
      );

      const chatResponse: ChatResponse = {
        id: uuidv4(),
        model: ollamaResponse.model,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
          cost: 0, // Ollama는 무료
        },
        choices: [{
          message: {
            role: 'assistant',
            content: ollamaResponse.message.content,
          },
          finishReason: ollamaResponse.done ? 'stop' : 'length',
        }],
        createdAt: new Date().toISOString(),
        finishReason: ollamaResponse.done ? 'stop' : 'length',
      };

      logger.info('✅ Ollama chat response received:', {
        model: chatResponse.model,
        promptTokens,
        completionTokens,
        contentLength: ollamaResponse.message.content.length,
        contentPreview: ollamaResponse.message.content.substring(0, 100) + '...',
      });

      return chatResponse;

    } catch (error: any) {
      logger.error('❌ Ollama API error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        baseUrl: this.baseUrl,
        model: request.model,
      });
      
      throw new Error(`Ollama request failed: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * 스트리밍 채팅 (추후 구현)
   */
  async* streamChat(request: ChatRequest): AsyncGenerator<string> {
    // TODO: Ollama 스트리밍 구현
    logger.warn('Ollama streaming not implemented yet, falling back to regular chat');
    const response = await this.chat(request);
    yield response.choices[0]?.message.content || '';
  }

  /**
   * 사용 가능한 모델 목록 조회
   */
  async getModels(): Promise<ModelInfo[]> {
    try {
      logger.info('Fetching Ollama models from:', `${this.baseUrl}/api/tags`);
      
      const response = await this.makeHttpRequest('/api/tags', 'GET');
      const data = response as { models: any[] };

      const models: ModelInfo[] = data.models.map((model: any) => ({
        id: model.name,
        name: model.name,
        provider: 'ollama' as LLMProvider,
        capabilities: ['chat'] as ModelCapability[],
        contextWindow: this.getContextWindowForModel(model.name),
        costPer1kTokens: {
          input: 0,
          output: 0,
        },
        status: 'active' as const,
        description: `Ollama model: ${model.name}`,
        version: model.digest ? model.digest.substring(0, 12) : 'unknown',
      }));

      logger.info(`Found ${models.length} Ollama models:`, models.map(m => m.name));
      return models;

    } catch (error: any) {
      logger.error('Failed to get Ollama models:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        baseUrl: this.baseUrl,
      });
      
      // 🔥 수정: 기본 모델들을 반환 (올바른 모델명)
      return [
        {
          id: 'gemma3:12b',
          name: 'Gemma 3 12B',
          provider: 'ollama',
          capabilities: ['chat'],
          contextWindow: 8192,
          costPer1kTokens: { input: 0, output: 0 },
          status: 'active',
          description: 'Gemma 3 12B model for production use',
        },
        {
          id: 'qwen3:14b',
          name: 'Qwen 3 14B',
          provider: 'ollama',
          capabilities: ['chat'],
          contextWindow: 32768,
          costPer1kTokens: { input: 0, output: 0 },
          status: 'active',
          description: 'Qwen 3 14B model for advanced tasks',
        }
      ];
    }
  }

  /**
   * 헬스체크
   */
  async healthCheck(): Promise<boolean> {
    try {
      logger.info('Performing Ollama health check:', `${this.baseUrl}/api/tags`);
      
      await this.makeHttpRequest('/api/tags', 'GET');
      
      logger.info('✅ Ollama health check passed');
      return true;
    } catch (error: any) {
      logger.error('❌ Ollama health check failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        baseUrl: this.baseUrl,
      });
      return false;
    }
  }

  /**
   * HTTP 요청을 만드는 헬퍼 메서드 (axios 대신 Node.js http 사용)
   */
  private async makeHttpRequest(path: string, method: 'GET' | 'POST', data?: any): Promise<any> {
    const url = new URL(path, this.baseUrl);
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    };

    const body = data ? JSON.stringify(data) : undefined;

    return new Promise((resolve, reject) => {
      const protocol = url.protocol === 'https:' ? require('https') : require('http');
      
      const req = protocol.request(url, options, (res: any) => {
        let responseData = '';
        
        res.on('data', (chunk: any) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              const parsed = JSON.parse(responseData);
              resolve(parsed);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
            }
          } catch (error) {
            reject(new Error(`Failed to parse response: ${responseData}`));
          }
        });
      });

      req.on('error', (error: any) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (body) {
        req.write(body);
      }
      
      req.end();
    });
  }

  /**
   * 🔥 수정: 모델별 컨텍스트 윈도우 크기 추정 (gemma3 우선)
   */
  private getContextWindowForModel(modelName: string): number {
    // 모델명에 따른 컨텍스트 윈도우 크기 추정
    if (modelName.includes('gemma3')) {
      return 8192;
    }
    if (modelName.includes('gemma2')) {
      return 8192;
    }
    if (modelName.includes('llama')) {
      return 4096;
    }
    if (modelName.includes('qwen3')) {
      return 32768;
    }
    if (modelName.includes('qwen')) {
      return 32768;
    }
    return 4096; // 기본값
  }

  /**
   * 토큰 사용량 추정 (Ollama는 정확한 토큰 카운트를 제공하지 않을 수 있음)
   */
  protected estimateTokens(text: string): number {
    // 더 정확한 토큰 추정 (한국어 고려)
    // 한국어는 보통 1.5-2 글자당 1토큰
    const koreanChars = (text.match(/[가-힣]/g) || []).length;
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    const otherChars = text.length - koreanChars - englishWords;
    
    return Math.ceil(koreanChars / 1.5 + englishWords * 1.3 + otherChars / 4);
  }
}
