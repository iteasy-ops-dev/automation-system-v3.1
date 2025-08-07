import dotenv from 'dotenv';
import { ServiceConfig } from '../types';

dotenv.config();

export const config: ServiceConfig = {
  port: parseInt(process.env.LLM_SERVICE_PORT || '8301', 10),
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },
  
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
    database: process.env.MONGODB_DATABASE || 'automation',
  },
  
  postgresql: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DATABASE || 'automation',
    user: process.env.POSTGRES_USER || 'automation',
    password: process.env.POSTGRES_PASSWORD || 'automation123',
  },
  
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    clientId: 'llm-service',
  },
  
  providers: {
    openai: process.env.OPENAI_API_KEY ? {
      apiKey: process.env.OPENAI_API_KEY,
      organization: process.env.OPENAI_ORG_ID,
    } : undefined,
    
    anthropic: process.env.ANTHROPIC_API_KEY ? {
      apiKey: process.env.ANTHROPIC_API_KEY,
    } : undefined,
    
    google: process.env.GOOGLE_API_KEY ? {
      apiKey: process.env.GOOGLE_API_KEY,
    } : undefined,
    
    azure: process.env.AZURE_OPENAI_API_KEY ? {
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
    } : undefined,
  },
  
  cache: {
    ttl: parseInt(process.env.LLM_CACHE_TTL || '3600', 10), // 1시간
    maxSize: parseInt(process.env.LLM_CACHE_MAX_SIZE || '1000', 10),
  },
};

// 필수 환경변수 검증
export function validateConfig(): void {
  const requiredVars = [
    'POSTGRES_PASSWORD',
    'REDIS_HOST',
  ];
  
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  // 최소 하나의 LLM 프로바이더는 설정되어야 함
  const hasProvider = Object.values(config.providers).some(provider => provider !== undefined);
  if (!hasProvider) {
    throw new Error('At least one LLM provider must be configured');
  }
}
