import * as winston from 'winston';

/**
 * Winston 로거 설정
 */
export function createLogger(): winston.Logger {
  const isDevelopment = process.env.NODE_ENV !== 'production';

  const logger = winston.createLogger({
    level: isDevelopment ? 'debug' : 'info',
    format: winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    defaultMeta: { 
      service: 'api-gateway',
      version: '3.1.0'
    },
    transports: [
      // Console output
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      }),
      
      // File output
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
      
      new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: 5242880, // 5MB
        maxFiles: 10,
      })
    ],
  });

  // Development에서는 더 자세한 로그
  if (isDevelopment) {
    logger.add(new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
        })
      )
    }));
  }

  return logger;
}