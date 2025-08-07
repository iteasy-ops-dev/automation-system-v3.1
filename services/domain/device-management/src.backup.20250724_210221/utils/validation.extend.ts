// Device Alerts 요청 검증
export const getDeviceAlertsSchema = Joi.object({
  id: deviceIdSchema,
  severity: Joi.string().valid('low', 'medium', 'high', 'critical').optional(),
  status: Joi.string().valid('active', 'acknowledged', 'resolved').optional(),
  limit: Joi.number().integer().min(1).max(1000).default(100),
  offset: Joi.number().integer().min(0).default(0)
});

// 검증 헬퍼 함수
export function validateRequest<T>(schema: Joi.ObjectSchema, data: any): T {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
    convert: true
  });

  if (error) {
    throw new ValidationError(
      'Invalid request data',
      error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }))
    );
  }

  return value as T;
}

// 커스텀 검증 에러 클래스
export class ValidationError extends Error {
  public readonly errors: Array<{
    field: string;
    message: string;
    value?: any;
  }>;

  constructor(message: string, errors: Array<{ field: string; message: string; value?: any; }>) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

// UUID 검증 헬퍼
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// ISO 날짜 검증 헬퍼
export function isValidISODate(date: string): boolean {
  const parsedDate = new Date(date);
  return !isNaN(parsedDate.getTime()) && parsedDate.toISOString() === date;
}

// 메트릭 값 범위 검증
export function validateMetricValue(metric: string, value: number): boolean {
  switch (metric) {
    case 'cpu':
    case 'memory':
    case 'disk':
      return value >= 0 && value <= 100;
    case 'temperature':
      return value >= -50 && value <= 150; // 실용적인 온도 범위
    case 'power':
      return value >= 0; // 전력은 0 이상
    case 'network':
      return value >= 0; // 네트워크 바이트는 0 이상
    default:
      return value >= 0; // 기본적으로 음수 금지
  }
}
