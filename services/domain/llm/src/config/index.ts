/**
 * LLM Service Configuration
 * 환경변수 기반 설정 관리
 */

import dotenv from 'dotenv';
import { LLMServiceConfig } from '../types/contracts';

// 환경변수 로드
dotenv.config();

export const config: LLMServiceConfig = {
  port: parseInt(process.env.LLM_SERVICE_PORT || '8301', 10),
  
  providers: [
    {
      id: 'openai-provider',
      name: 'OpenAI',
      providerType: 'openai',
      apiEndpoint: 'https://api.openai.com/v1',
      apiKeyHash: process.env.OPENAI_API_KEY || '',
      models: [
        {
          id: 'gpt-4',
          name: 'GPT-4',
          provider: 'openai',
          capabilities: ['chat', 'completion'],
          contextWindow: 8192,
          costPer1kTokens: {
            input: 0.03,
            output: 0.06,
          },
          status: 'active',
          description: 'OpenAI의 가장 강력한 언어 모델',
        },
        {
          id: 'gpt-3.5-turbo',
          name: 'GPT-3.5 Turbo',
          provider: 'openai',
          capabilities: ['chat', 'completion'],
          contextWindow: 4096,
          costPer1kTokens: {
            input: 0.001,
            output: 0.002,
          },
          status: 'active',
          description: '빠르고 효율적인 대화 모델',
        },
      ],
      rateLimits: {
        requestsPerMinute: 200,
        tokensPerMinute: 150000,
        tokensPerHour: 1000000,
        concurrent: 10,
      },
      config: {
        organization: process.env.OPENAI_ORG_ID,
        timeout: 30000,
        maxRetries: 3,
      },
      status: 'active',
      healthCheckUrl: 'https://api.openai.com/v1/models',
      lastHealthCheck: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'anthropic-provider',
      name: 'Anthropic',
      providerType: 'anthropic',
      apiEndpoint: 'https://api.anthropic.com/v1',
      apiKeyHash: process.env.ANTHROPIC_API_KEY || '',
      models: [
        {
          id: 'claude-3-opus',
          name: 'Claude 3 Opus',
          provider: 'anthropic',
          capabilities: ['chat'],
          contextWindow: 200000,
          costPer1kTokens: {
            input: 0.015,
            output: 0.075,
          },
          status: 'active',
          description: 'Anthropic의 최고 성능 모델',
        },
        {
          id: 'claude-3-sonnet',
          name: 'Claude 3 Sonnet',
          provider: 'anthropic',
          capabilities: ['chat'],
          contextWindow: 200000,
          costPer1kTokens: {
            input: 0.003,
            output: 0.015,
          },
          status: 'active',
          description: '균형잡힌 성능과 속도',
        },
      ],
      rateLimits: {
        requestsPerMinute: 100,
        tokensPerMinute: 100000,
        tokensPerHour: 500000,
        concurrent: 5,
      },
      config: {
        timeout: 45000,
        maxRetries: 3,
      },
      status: 'active',
      healthCheckUrl: 'https://api.anthropic.com/v1/messages',
      lastHealthCheck: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  
  cache: {
    ttl: 3600, // 1시간
    maxSize: 10000,
    similarityThreshold: 0.95,
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
  },
  
  databases: {
    postgres: {
      host: process.env.POSTGRES_HOST || 'postgres',
      port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
      database: process.env.POSTGRES_DB || 'automation',
      username: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || '',
    },
    mongodb: {
      url: process.env.MONGODB_URL || 'mongodb://mongodb:27017',
      database: process.env.MONGODB_DB || 'automation',
    },
    redis: {
      host: process.env.REDIS_HOST || 'redis',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0', 10),
    },
  },
  
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    clientId: 'llm-service',
    groupId: 'llm-service-group',
  },
};

/**
 * 환경설정 검증
 */
export function validateConfig(): void {
  const errors: string[] = [];
  
  // 필수 환경변수 확인
  if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    errors.push('At least one LLM provider API key must be set');
  }
  
  if (!process.env.POSTGRES_PASSWORD) {
    errors.push('POSTGRES_PASSWORD is required');
  }
  
  // 포트 검증
  if (isNaN(config.port) || config.port < 1 || config.port > 65535) {
    errors.push('Invalid port number');
  }
  
  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

/**
 * 환경별 설정 오버라이드
 */
export function getEnvironmentConfig(): Partial<LLMServiceConfig> {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'production':
      return {
        logging: {
          level: 'warn',
          format: 'json',
        },
        cache: {
          ...config.cache,
          ttl: 7200, // 2시간
          maxSize: 50000,
        },
      };
      
    case 'test':
      return {
        logging: {
          level: 'error',
          format: 'simple',
        },
        cache: {
          ...config.cache,
          ttl: 60, // 1분
          maxSize: 100,
        },
      };
      
    default: // development
      return {
        logging: {
          level: 'debug',
          format: 'simple',
        },
      };
  }
}

/**
 * 최종 설정 객체 (환경별 오버라이드 적용)
 */
export const finalConfig: LLMServiceConfig = {
  ...config,
  ...getEnvironmentConfig(),
};
