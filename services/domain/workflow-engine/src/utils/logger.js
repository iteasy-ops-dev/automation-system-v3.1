const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'workflow-engine',
    version: '1.0.0',
    architecture: 'v3.1'
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// 프로덕션 환경에서는 파일 로그도 추가
if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.File({
    filename: 'logs/workflow-engine-error.log',
    level: 'error'
  }));
  
  logger.add(new winston.transports.File({
    filename: 'logs/workflow-engine-combined.log'
  }));
}

module.exports = logger;