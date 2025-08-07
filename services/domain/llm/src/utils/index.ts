// LLM Service 유틸리티 통합 인덱스

export * from './config';
export * from './helpers';
export { default as logger, logRequest, logResponse, logLLMRequest, logLLMResponse } from './logger';

// 검증 함수들
export function validateChatRequest(req: any): string[] {
  const errors: string[] = [];
  
  if (!req.messages || !Array.isArray(req.messages)) {
    errors.push('messages field is required and must be an array');
  } else if (req.messages.length === 0) {
    errors.push('messages array cannot be empty');
  } else {
    req.messages.forEach((msg: any, index: number) => {
      if (!msg.role || !['system', 'user', 'assistant'].includes(msg.role)) {
        errors.push(`message[${index}].role must be one of: system, user, assistant`);
      }
      if (!msg.content || typeof msg.content !== 'string') {
        errors.push(`message[${index}].content is required and must be a string`);
      }
    });
  }
  
  if (req.temperature !== undefined) {
    if (typeof req.temperature !== 'number' || req.temperature < 0 || req.temperature > 2) {
      errors.push('temperature must be a number between 0 and 2');
    }
  }
  
  if (req.maxTokens !== undefined) {
    if (!Number.isInteger(req.maxTokens) || req.maxTokens < 1 || req.maxTokens > 8192) {
      errors.push('maxTokens must be an integer between 1 and 8192');
    }
  }
  
  return errors;
}
