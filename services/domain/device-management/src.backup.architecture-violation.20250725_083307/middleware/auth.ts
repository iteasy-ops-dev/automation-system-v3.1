// src/middleware/auth.ts
// 간단한 인증 미들웨어

import { Request, Response, NextFunction } from 'express';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // 개발 환경에서는 인증 우회
  if (process.env.NODE_ENV === 'development') {
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Missing or invalid authorization header',
      timestamp: new Date(),
    });
    return;
  }

  // 실제 구현에서는 JWT 토큰 검증
  next();
}
