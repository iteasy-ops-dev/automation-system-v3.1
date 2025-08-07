/**
 * Logging Middleware
 * 요청/응답 로깅
 */

import { Request, Response, NextFunction } from 'express';

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();
  
  // 요청 로깅
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  
  // 응답 완료 시 로깅
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`
    );
  });
  
  next();
}
