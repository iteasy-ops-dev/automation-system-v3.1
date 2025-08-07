/**
 * 유효성 검증 유틸리티
 * API 요청 데이터 검증 및 변환
 */

/**
 * UUID 형식 검증
 */
export function validateUUID(value: string, fieldName: string = 'ID'): void {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  if (!value || typeof value !== 'string' || !uuidRegex.test(value)) {
    throw new Error(`${fieldName} must be a valid UUID format`);
  }
}

/**
 * 페이지네이션 파라미터 검증
 */
export function validatePagination(value: number, min: number, max: number): number {
  if (isNaN(value) || value < min || value > max) {
    throw new Error(`Value must be between ${min} and ${max}`);
  }
  return value;
}

/**
 * 이메일 형식 검증
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * URL 형식 검증
 */
export function validateURL(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * 문자열 길이 검증
 */
export function validateStringLength(value: string, min: number, max: number, fieldName: string): void {
  if (!value || typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string`);
  }
  
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw new Error(`${fieldName} must be between ${min} and ${max} characters`);
  }
}

/**
 * 객체 필수 필드 검증
 */
export function validateRequiredFields(obj: any, requiredFields: string[]): void {
  for (const field of requiredFields) {
    if (!(field in obj) || obj[field] === null || obj[field] === undefined) {
      throw new Error(`${field} is required`);
    }
  }
}

/**
 * 열거형 값 검증
 */
export function validateEnum(value: any, allowedValues: any[], fieldName: string): void {
  if (!allowedValues.includes(value)) {
    throw new Error(`${fieldName} must be one of: ${allowedValues.join(', ')}`);
  }
}
