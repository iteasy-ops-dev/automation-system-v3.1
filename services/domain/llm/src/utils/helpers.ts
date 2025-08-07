import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

// 토큰 카운팅을 위한 간단한 추정 함수
export function estimateTokens(text: string): number {
  // GPT 토큰화는 대략 4글자당 1토큰으로 추정 (영어 기준)
  // 한국어는 약간 더 많이 사용하므로 3글자당 1토큰으로 보수적 추정
  const avgCharsPerToken = 3.5;
  return Math.ceil(text.length / avgCharsPerToken);
}

// 시맨틱 해시 생성 (캐싱용)
export function generateSemanticHash(messages: any[]): string {
  // 메시지 내용만으로 해시 생성 (순서와 내용이 중요)
  const content = messages
    .map(msg => `${msg.role}:${msg.content}`)
    .join('|');
  
  return crypto
    .createHash('sha256')
    .update(content)
    .digest('hex')
    .substring(0, 16); // 16자리로 단축
}

// Redis 키 생성
export function generateCacheKey(type: string, hash: string): string {
  return `automation:cache:llm:${type}:${hash}`;
}

export function generateUsageKey(provider: string, date: string): string {
  return `automation:usage:llm:${provider}:${date}`;
}

// 요청 ID 생성
export function generateRequestId(): string {
  return uuidv4();
}

// 에러 정규화
export function normalizeError(error: any): { code: string; message: string; details?: any } {
  if (error.response?.data) {
    // HTTP 에러
    return {
      code: error.response.status?.toString() || 'HTTP_ERROR',
      message: error.response.data.message || error.message,
      details: error.response.data
    };
  }
  
  if (error.code) {
    return {
      code: error.code,
      message: error.message,
      details: error
    };
  }
  
  return {
    code: 'UNKNOWN_ERROR',
    message: error.message || 'Unknown error occurred',
    details: error
  };
}

// 비용 계산
export function calculateCost(provider: string, model: string, usage: { promptTokens: number; completionTokens: number }): number {
  // 간단한 비용 모델 (실제로는 더 정확한 모델 필요)
  const costModels: Record<string, Record<string, { input: number; output: number }>> = {
    openai: {
      'gpt-4': { input: 0.03, output: 0.06 }, // per 1K tokens
      'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
    },
    anthropic: {
      'claude-3-opus': { input: 0.015, output: 0.075 },
      'claude-3-sonnet': { input: 0.003, output: 0.015 },
    }
  };
  
  const modelCost = costModels[provider]?.[model];
  if (!modelCost) {
    return 0; // 알 수 없는 모델
  }
  
  const inputCost = (usage.promptTokens / 1000) * modelCost.input;
  const outputCost = (usage.completionTokens / 1000) * modelCost.output;
  
  return Math.round((inputCost + outputCost) * 10000) / 10000; // 소수점 4자리
}

// 시간 관련 유틸리티
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export function getCurrentDateString(): string {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}
