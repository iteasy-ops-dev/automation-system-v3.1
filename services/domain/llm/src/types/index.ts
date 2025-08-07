// LLM Service 타입 통합 인덱스

export * from './api.types';
export * from './extended.types';
export * from './events.types';

// 유틸리티 타입들
export interface ServiceConfig {
  port: number;
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  mongodb: {
    uri: string;
    database: string;
  };
  postgresql: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
  kafka: {
    brokers: string[];
    clientId: string;
  };
  providers: {
    openai?: {
      apiKey: string;
      organization?: string;
    };
    anthropic?: {
      apiKey: string;
    };
    google?: {
      apiKey: string;
    };
    azure?: {
      apiKey: string;
      endpoint: string;
    };
  };
  cache: {
    ttl: number;
    maxSize: number;
  };
}

export interface RequestContext {
  requestId: string;
  userId?: string;
  sessionId?: string;
  correlationId?: string;
  startTime: number;
}
