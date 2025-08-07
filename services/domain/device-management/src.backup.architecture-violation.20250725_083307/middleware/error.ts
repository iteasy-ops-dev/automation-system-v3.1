// src/middleware/error.ts
// 간단한 에러 미들웨어

import { Request, Response, NextFunction } from 'express';

export function errorMiddleware(err: any, req: Request, res: Response, next: NextFunction): void {
  console.error('Unhandled error:', err);
  
  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
    timestamp: new Date(),
  });
}
