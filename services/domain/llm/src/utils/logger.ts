import winston from 'winston';

// LLM Service 전용 로거 구성
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.metadata({
      fillExcept: ['message', 'level', 'timestamp', 'service']
    })
  ),
  defaultMeta: { 
    service: 'llm-service',
    version: '1.0.0'
  },
  transports: [
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
  ],
});

// 개발 환경에서는 콘솔 출력 추가
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
      winston.format.printf(({ level, message, timestamp, service, ...meta }) => {
        const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
        return `${timestamp} [${service}] ${level}: ${message} ${metaStr}`;
      })
    )
  }));
}

// 구조화된 로깅을 위한 헬퍼 함수들
export const logRequest = (requestId: string, method: string, path: string, userId?: string) => {
  logger.info('HTTP Request', {
    requestId,
    method,
    path,
    userId,
    type: 'request'
  });
};

export const logResponse = (requestId: string, statusCode: number, duration: number) => {
  logger.info('HTTP Response', {
    requestId,
    statusCode,
    duration,
    type: 'response'
  });
};

export const logLLMRequest = (requestId: string, provider: string, model: string, tokens: number) => {
  logger.info('LLM Request', {
    requestId,
    provider,
    model,
    tokens,
    type: 'llm_request'
  });
};

export const logLLMResponse = (requestId: string, provider: string, model: string, usage: any, duration: number) => {
  logger.info('LLM Response', {
    requestId,
    provider,
    model,
    usage,
    duration,
    type: 'llm_response'
  });
};

export default logger;
