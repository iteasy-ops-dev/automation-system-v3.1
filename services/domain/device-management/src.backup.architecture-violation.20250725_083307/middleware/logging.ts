// src/middleware/logging.ts
// 간단한 로깅 미들웨어

import { Request, Response, NextFunction } from 'express';

export function loggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`);
  });
  
  next();
}
