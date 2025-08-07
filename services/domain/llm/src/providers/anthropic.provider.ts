/**
 * Anthropic Provider Implementation
 * Anthropic Claude API를 통한 LLM 요청 처리
 */

import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import { BaseLLMProvider } from './base.provider';
import { ChatRequest, ChatResponse, ModelInfo, LLMProvider } from '../types/contracts';
import { LLMProviderConfig } from '../types/provider.types';
import { finalConfig } from '../config';
import logger from '../utils/logger';

export class AnthropicProvider extends BaseLLMProvider {
  protected providerType: LLMProvider = 'anthropic';
  protected apiKey: string;
  private client: Anthropic;

  constructor(config?: LLMProviderConfig) {
    super();
    
    if (config?.apiKey) {
      // 동적 config 사용
      this.apiKey = config.apiKey;
      this.client = new Anthropic({
        apiKey: this.apiKey,
        baseURL: config.baseUrl,
        timeout: config.timeout || 45000,
        maxRetries: 3,
      });
    } else {
      // 환경변수 기반 폴백
      const providerConfig = finalConfig.providers.find(p => p.providerType === 'anthropic');
      if (!providerConfig?.apiKeyHash) {
        throw new Error('Anthropic API key not configured');
      }

      this.apiKey = providerConfig.apiKeyHash;
      this.client = new Anthropic({
        apiKey: this.apiKey,
        timeout: providerConfig.config.timeout || 45000,
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
      // Anthropic 메시지 형식으로 변환
      const anthropicMessages = this.convertMessages(request.messages);
      const systemMessage = request.messages.find(m => m.role === 'system')?.content;

      const response = await this.withTimeout(
        this.client.messages.create({
          model: request.model || 'claude-3-sonnet-20240229',
          max_tokens: request.maxTokens || 1000,
          temperature: request.temperature,
          system: systemMessage,
          messages: anthropicMessages,
        }),
        45000
      );

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Anthropic');
      }

      return {
        id: uuidv4(),
        model: response.model,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
          cost: this.calculateCost(response.model, response.usage.input_tokens + response.usage.output_tokens),
        },
        choices: [{
          message: {
            role: 'assistant',
            content: content.text,
          },
          finishReason: response.stop_reason === 'end_turn' ? 'stop' : 
                       response.stop_reason === 'max_tokens' ? 'length' : 'stop',
        }],
        createdAt: new Date().toISOString(),
        finishReason: response.stop_reason === 'end_turn' ? 'stop' : 
                     response.stop_reason === 'max_tokens' ? 'length' : 'stop',
      };

    } catch (error) {
      logger.error('Anthropic API error:', error);
      throw new Error(`Anthropic request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 스트리밍 채팅
   */
  async* streamChat(request: ChatRequest): AsyncGenerator<string> {
    this.validateRequest(request);

    try {
      const anthropicMessages = this.convertMessages(request.messages);
      const systemMessage = request.messages.find(m => m.role === 'system')?.content;

      const stream = await this.client.messages.create({
        model: request.model || 'claude-3-sonnet-20240229',
        max_tokens: request.maxTokens || 1000,
        temperature: request.temperature,
        system: systemMessage,
        messages: anthropicMessages,
        stream: true,
      });

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          yield chunk.delta.text;
        }
      }
    } catch (error) {
      logger.error('Anthropic streaming error:', error);
      throw new Error(`Anthropic streaming failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 사용 가능한 모델 목록 조회
   */
  async getModels(): Promise<ModelInfo[]> {
    try {
      const providerConfig = finalConfig.providers.find(p => p.providerType === 'anthropic');
      return providerConfig?.models || [];
    } catch (error) {
      logger.error('Failed to get Anthropic models:', error);
      return [];
    }
  }

  /**
   * 헬스체크
   */
  async healthCheck(): Promise<boolean> {
    try {
      // 간단한 테스트 메시지로 헬스체크
      await this.withTimeout(
        this.client.messages.create({
          model: 'claude-3-haiku-20240307',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
        10000
      );
      return true;
    } catch (error) {
      logger.error('Anthropic health check failed:', error);
      return false;
    }
  }

  /**
   * OpenAI 형식 메시지를 Anthropic 형식으로 변환
   */
  private convertMessages(messages: any[]): Anthropic.MessageParam[] {
    return messages
      .filter(msg => msg.role !== 'system') // system 메시지는 별도 처리
      .map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      })) as Anthropic.MessageParam[];
  }

  /**
   * 비용 계산
   */
  private calculateCost(model: string, tokens: number): number {
    const providerConfig = finalConfig.providers.find(p => p.providerType === 'anthropic');
    const modelInfo = providerConfig?.models.find(m => m.id.includes(model.split('-')[0]));
    
    if (!modelInfo?.costPer1kTokens) {
      return 0;
    }

    // 간단한 비용 계산 (실제로는 입력/출력 토큰 구분 필요)
    const avgCost = (modelInfo.costPer1kTokens.input + modelInfo.costPer1kTokens.output) / 2;
    return (tokens / 1000) * avgCost;
  }
}
