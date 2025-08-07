/**
 * Base LLM Provider - 추상 기본 클래스
 * 모든 LLM 프로바이더가 구현해야 할 공통 인터페이스
 */

import { ChatRequest, ChatResponse, ModelInfo, LLMProvider } from '../types/contracts';

export abstract class BaseLLMProvider {
  protected abstract providerType: LLMProvider;
  protected abstract apiKey: string;

  /**
   * 채팅 요청 처리 (필수 구현)
   */
  abstract chat(request: ChatRequest): Promise<ChatResponse>;

  /**
   * 스트리밍 채팅 (선택적 구현)
   */
  abstract streamChat?(request: ChatRequest): AsyncGenerator<string>;

  /**
   * 사용 가능한 모델 목록 조회 (필수 구현)
   */
  abstract getModels(): Promise<ModelInfo[]>;

  /**
   * 헬스체크 (필수 구현)
   */
  abstract healthCheck(): Promise<boolean>;

  /**
   * 프로바이더 타입 반환
   */
  getProviderType(): LLMProvider {
    return this.providerType;
  }

  /**
   * API 키 설정
   */
  protected setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * 요청 전 공통 검증
   */
  protected validateRequest(request: ChatRequest): void {
    if (!request.messages || request.messages.length === 0) {
      throw new Error('Messages array is required and cannot be empty');
    }

    if (request.maxTokens && (request.maxTokens < 1 || request.maxTokens > 8192)) {
      throw new Error('maxTokens must be between 1 and 8192');
    }

    if (request.temperature && (request.temperature < 0 || request.temperature > 2)) {
      throw new Error('temperature must be between 0 and 2');
    }
  }

  /**
   * 토큰 사용량 계산 (기본 구현)
   */
  protected estimateTokens(text: string): number {
    // 간단한 토큰 추정 (실제로는 tiktoken 등 사용)
    return Math.ceil(text.length / 4);
  }

  /**
   * 에러 처리 및 재시도 로직
   */
  protected async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt === maxRetries) {
          throw lastError;
        }

        // 지수 백오프
        await this.sleep(delay * Math.pow(2, attempt - 1));
      }
    }

    throw lastError!;
  }

  /**
   * 지연 함수
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 요청 타임아웃 처리
   */
  protected withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
      )
    ]);
  }
}
