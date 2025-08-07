require('dotenv').config();

const config = {
  // Server Configuration
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT) || 8401,
  
  // Database Configuration
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://automation:automation123@localhost:5432/automation',
  MONGODB_URL: process.env.MONGODB_URL || 'mongodb://localhost:27017/automation',
  MONGODB_DB_NAME: process.env.MONGODB_DB_NAME || 'automation',
  
  // Redis Configuration
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  REDIS_PREFIX: process.env.REDIS_PREFIX || 'automation:workflow:',
  
  // Kafka Configuration
  KAFKA_BROKERS: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  KAFKA_GROUP_ID: process.env.KAFKA_GROUP_ID || 'workflow-engine-service',
  KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID || 'workflow-engine',
  
  // External Services (기존 완료된 서비스들)
  SERVICES: {
    STORAGE: process.env.STORAGE_SERVICE_URL || 'http://localhost:8001',
    DEVICE: process.env.DEVICE_SERVICE_URL || 'http://localhost:8101',
    MCP: process.env.MCP_SERVICE_URL || 'http://localhost:8201',
    LLM: process.env.LLM_SERVICE_URL || 'http://localhost:8301',
    GATEWAY: process.env.GATEWAY_SERVICE_URL || 'http://localhost:8000'
  },
  
  // n8n Configuration
  N8N: {
    ENCRYPTION_KEY: process.env.N8N_ENCRYPTION_KEY || 'workflow_encryption_key_32_chars_long',
    USER_FOLDER: process.env.N8N_USER_FOLDER || '/tmp/n8n',
    BASIC_AUTH_ACTIVE: process.env.N8N_BASIC_AUTH_ACTIVE === 'true',
    BASIC_AUTH_USER: process.env.N8N_BASIC_AUTH_USER || 'admin',
    BASIC_AUTH_PASSWORD: process.env.N8N_BASIC_AUTH_PASSWORD || 'password'
  },
  
  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_FORMAT: process.env.LOG_FORMAT || 'json',
  
  // Security
  JWT_SECRET: process.env.JWT_SECRET || 'your_jwt_secret_here',
  API_RATE_LIMIT: parseInt(process.env.API_RATE_LIMIT) || 1000,
  
  // Monitoring
  METRICS_PORT: parseInt(process.env.METRICS_PORT) || 9091,
  HEALTH_CHECK_INTERVAL: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000,
  
  // Workflow Execution
  EXECUTION_TIMEOUT: parseInt(process.env.EXECUTION_TIMEOUT) || 300000, // 5분
  MAX_CONCURRENT_EXECUTIONS: parseInt(process.env.MAX_CONCURRENT_EXECUTIONS) || 10,
  RETRY_ATTEMPTS: parseInt(process.env.RETRY_ATTEMPTS) || 3,
  STEP_TIMEOUT: parseInt(process.env.STEP_TIMEOUT) || 60000 // 1분
};

module.exports = config;