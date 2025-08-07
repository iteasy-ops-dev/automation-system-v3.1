/**
 * OpenAI Provider Implementation
 * OpenAI API를 통한 LLM 요청 처리
 */

import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { BaseLLMProvider } from './base.provider';
import { ChatRequest, ChatResponse, ModelInfo, LLMProvider } from '../types/contracts';
import { LLMProviderConfig } from '../types/provider.types';
import { finalConfig } from '../config';
import logger from '../utils/logger';

export class OpenAIProvider extends BaseLLMProvider {
  protected providerType: LLMProvider = 'openai';
  protected apiKey: string;
  private client: OpenAI;

  constructor(config?: LLMProviderConfig) {
    super();
    
    if (config?.apiKey) {
      // 동적 config 사용
      this.apiKey = config.apiKey;
      this.client = new OpenAI({
        apiKey: this.apiKey,
        baseURL: config.baseUrl,
        timeout: config.timeout || 30000,
        maxRetries: 3,
      });
    } else {
      // 환경변수 기반 폴백
      const providerConfig = finalConfig.providers.find(p => p.providerType === 'openai');
      if (!providerConfig?.apiKeyHash) {
        throw new Error('OpenAI API key not configured');
      }

      this.apiKey = providerConfig.apiKeyHash;
      this.client = new OpenAI({
        apiKey: this.apiKey,
        timeout: providerConfig.config.timeout || 30000,
        maxRetries: providerConfig.config.maxRetries || 3,
      });
    }
  }

  /**
   * 채팅 요청 처리
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    this.validateRequest(request);

    try {
      const response = await this.withTimeout(
        this.client.chat.completions.create({
          model: request.model || 'gpt-3.5-turbo',
          messages: request.messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            ...(msg.name && { name: msg.name }),
          })),
          temperature: request.temperature,
          max_tokens: request.maxTokens,
          top_p: request.topP,
          frequency_penalty: request.frequencyPenalty,
          presence_penalty: request.presencePenalty,
          stop: request.stop,
        }),
        30000
      );

      const choice = response.choices[0];
      if (!choice?.message) {
        throw new Error('No response from OpenAI');
      }

      return {
        id: uuidv4(),
        model: response.model,
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
          cost: this.calculateCost(response.model, response.usage?.total_tokens || 0),
        },
        choices: [{
          message: {
            role: 'assistant',
            content: choice.message.content || '',
          },
          finishReason: choice.finish_reason as any,
        }],
        createdAt: new Date().toISOString(),
        finishReason: choice.finish_reason as any,
      };

    } catch (error) {
      logger.error('OpenAI API error:', error);
      throw new Error(`OpenAI request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 스트리밍 채팅
   */
  async* streamChat(request: ChatRequest): AsyncGenerator<string> {
    this.validateRequest(request);

    try {
      const stream = await this.client.chat.completions.create({
        model: request.model || 'gpt-3.5-turbo',
        messages: request.messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          ...(msg.name && { name: msg.name }),
        })),
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    } catch (error) {
      logger.error('OpenAI streaming error:', error);
      throw new Error(`OpenAI streaming failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 사용 가능한 모델 목록 조회
   */
  async getModels(): Promise<ModelInfo[]> {
    try {
      const providerConfig = finalConfig.providers.find(p => p.providerType === 'openai');
      return providerConfig?.models || [];
    } catch (error) {
      logger.error('Failed to get OpenAI models:', error);
      return [];
    }
  }

  /**
   * 헬스체크
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.withTimeout(
        this.client.models.list(),
        5000
      );
      return true;
    } catch (error) {
      logger.error('OpenAI health check failed:', error);
      return false;
    }
  }

  /**
   * 비용 계산
   */
  private calculateCost(model: string, tokens: number): number {
    const providerConfig = finalConfig.providers.find(p => p.providerType === 'openai');
    const modelInfo = providerConfig?.models.find(m => m.id === model);
    
    if (!modelInfo?.costPer1kTokens) {
      return 0;
    }

    // 간단한 비용 계산 (실제로는 입력/출력 토큰 구분 필요)
    const avgCost = (modelInfo.costPer1kTokens.input + modelInfo.costPer1kTokens.output) / 2;
    return (tokens / 1000) * avgCost;
  }
}
