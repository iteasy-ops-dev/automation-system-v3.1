/**
 * Device Management Service - 입력 검증 유틸리티
 * Joi 기반 스키마 검증
 */

import Joi from 'joi';

// 공통 스키마
export const commonSchemas = {
  uuid: Joi.string().uuid(),
  timestamp: Joi.date().iso(),
  pagination: Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(20),
    offset: Joi.number().integer().min(0).default(0)
  }),
  tags: Joi.array().items(Joi.string().max(50)).max(10)
};

// 장비 관련 스키마
export const deviceSchemas = {
  create: Joi.object({
    name: Joi.string().min(1).max(100).required(),
    type: Joi.string().valid('server', 'network', 'storage', 'iot').required(),
    groupId: Joi.string().uuid().allow(null),
    metadata: Joi.object().unknown(true).default({}),
    tags: commonSchemas.tags.default([])
  }),
  
  update: Joi.object({
    name: Joi.string().min(1).max(100),
    type: Joi.string().valid('server', 'network', 'storage', 'iot'),
    status: Joi.string().valid('active', 'inactive', 'maintenance'),
    groupId: Joi.string().uuid().allow(null),
    metadata: Joi.object().unknown(true),
    tags: commonSchemas.tags
  }).min(1),
  
  query: Joi.object({
    type: Joi.string().valid('server', 'network', 'storage', 'iot'),
    status: Joi.string().valid('active', 'inactive', 'maintenance'),
    groupId: Joi.string().uuid(),
    tags: Joi.array().items(Joi.string()),
    search: Joi.string().max(100),
    ...commonSchemas.pagination.extract(['limit', 'offset'])
  }),
  
  heartbeat: Joi.object({
    timestamp: commonSchemas.timestamp.required(),
    status: Joi.string().valid('online', 'offline', 'error', 'maintenance').required(),
    metrics: Joi.object({
      cpu: Joi.number().min(0).max(100),
      memory: Joi.number().min(0).max(100),
      disk: Joi.number().min(0).max(100),
      network_in: Joi.number().min(0),
      network_out: Joi.number().min(0),
      temperature: Joi.number(),
      power_consumption: Joi.number().min(0)
    }).unknown(true)
  }),
  
  metricsQuery: Joi.object({
    metric: Joi.string().valid('cpu', 'memory', 'disk', 'network', 'temperature', 'power'),
    start: commonSchemas.timestamp,
    end: commonSchemas.timestamp,
    interval: Joi.string().valid('1m', '5m', '15m', '1h', '6h', '24h').default('5m'),
    includeMetrics: Joi.boolean().default(true),
    includeErrors: Joi.boolean().default(true)
  })
};

// 그룹 관련 스키마
export const groupSchemas = {
  create: Joi.object({
    name: Joi.string().min(1).max(100).required(),
    description: Joi.string().max(500),
    parentId: Joi.string().uuid().allow(null),
    metadata: Joi.object().unknown(true).default({})
  }),
  
  update: Joi.object({
    name: Joi.string().min(1).max(100),
    description: Joi.string().max(500),
    parentId: Joi.string().uuid().allow(null),
    metadata: Joi.object().unknown(true)
  }).min(1)
};

// 검증 헬퍼 함수
export function validateInput<T>(schema: Joi.Schema, input: any): T {
  const { error, value } = schema.validate(input, {
    allowUnknown: false,
    stripUnknown: true,
    abortEarly: false
  });
  
  if (error) {
    const details = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));
    
    throw new ValidationError('입력 검증 실패', details);
  }
  
  return value as T;
}

export class ValidationError extends Error {
  public details: Array<{ field: string; message: string }>;
  
  constructor(message: string, details: Array<{ field: string; message: string }>) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

export function sanitizeString(input: string, maxLength: number = 255): string {
  return input.trim().substring(0, maxLength);
}

export function parseBoolean(input: any): boolean {
  if (typeof input === 'boolean') return input;
  if (typeof input === 'string') {
    return ['true', 'yes', '1', 'on'].includes(input.toLowerCase());
  }
  return Boolean(input);
}
