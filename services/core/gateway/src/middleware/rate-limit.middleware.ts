import { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';
import * as winston from 'winston';
import { config } from '../config/gateway.config';
import {
  AuthenticatedRequest,
  RateLimitError,
  ErrorResponse,
  RedisKeyPattern,
} from '../types/gateway.types';

/**
 * Rate Limiting 미들웨어
 * 슬라이딩 윈도우 방식으로 요청 제한
 */
export class RateLimitMiddleware {
  private readonly redis: Redis;
  private readonly logger: winston.Logger;

  constructor(redis: Redis, logger: winston.Logger) {
    this.redis = redis;
    this.logger = logger;
  }

  /**
   * IP 기반 기본 Rate Limiting
   */
  basic(windowMs: number = config.security.rateLimitWindowMs, maxRequests: number = config.security.rateLimitMaxRequests) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const clientIp = this.getClientIP(req);
        const key = `${RedisKeyPattern.RATE_LIMIT}ip:${clientIp}`;
        
        const isAllowed = await this.checkRateLimit(key, windowMs, maxRequests);
        
        if (!isAllowed) {
          this.sendRateLimitError(res, 'IP 기반 요청 한도를 초과했습니다.');
          return;
        }

        next();
      } catch (error) {
        this.logger.error('Rate limiting 오류', { error });
        // 에러 시에는 요청을 통과시킴 (가용성 우선)
        next();
      }
    };
  }
  /**
   * 사용자별 Rate Limiting
   */
  perUser(windowMs: number = config.security.rateLimitWindowMs, maxRequests: number = config.security.rateLimitMaxRequests) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = req.user?.id;
        
        if (!userId) {
          // 인증되지 않은 사용자는 IP 기반으로 제한
          return this.basic(windowMs, maxRequests)(req, res, next);
        }

        const key = `${RedisKeyPattern.RATE_LIMIT}user:${userId}`;
        
        const isAllowed = await this.checkRateLimit(key, windowMs, maxRequests);
        
        if (!isAllowed) {
          this.sendRateLimitError(res, '사용자별 요청 한도를 초과했습니다.');
          return;
        }

        next();
      } catch (error) {
        this.logger.error('사용자별 Rate limiting 오류', { error });
        next();
      }
    };
  }

  /**
   * 로그인 보호용 Rate Limiting (더 엄격)
   */
  loginProtection() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const clientIp = this.getClientIP(req);
        const key = `${RedisKeyPattern.RATE_LIMIT}login:${clientIp}`;
        
        // 로그인은 더 엄격하게: 5분간 10회로 제한
        const isAllowed = await this.checkRateLimit(key, 5 * 60 * 1000, 10);
        
        if (!isAllowed) {
          this.sendRateLimitError(res, '로그인 시도 한도를 초과했습니다. 5분 후 다시 시도해주세요.');
          return;
        }

        next();
      } catch (error) {
        this.logger.error('로그인 Rate limiting 오류', { error });
        next();
      }
    };
  }
  /**
   * 슬라이딩 윈도우 방식으로 Rate Limit 확인
   */
  private async checkRateLimit(key: string, windowMs: number, maxRequests: number): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - windowMs;

    // Lua 스크립트로 원자적 연산 수행
    const luaScript = `
      local key = KEYS[1]
      local window_start = ARGV[1]
      local now = ARGV[2]
      local max_requests = ARGV[3]
      local window_ms = ARGV[4]

      -- 윈도우 밖의 오래된 기록 삭제
      redis.call('zremrangebyscore', key, '-inf', window_start)
      
      -- 현재 윈도우 내 요청 수 확인
      local current_requests = redis.call('zcard', key)
      
      if current_requests < tonumber(max_requests) then
        -- 요청 허용: 현재 시각 추가
        redis.call('zadd', key, now, now)
        redis.call('expire', key, math.ceil(tonumber(window_ms) / 1000))
        return 1
      else
        -- 요청 거부
        return 0
      end
    `;

    const result = await this.redis.eval(
      luaScript,
      1,
      key,
      windowStart.toString(),
      now.toString(),
      maxRequests.toString(),
      windowMs.toString()
    ) as number;

    return result === 1;
  }

  /**
   * 클라이언트 IP 주소 추출
   */
  private getClientIP(req: Request): string {
    return (
      req.ip ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }

  /**
   * Rate Limit 초과 에러 응답
   */
  private sendRateLimitError(res: Response, message: string): void {
    const errorResponse: ErrorResponse = {
      error: 'RATE_LIMIT_EXCEEDED',
      message,
      timestamp: new Date().toISOString(),
    };

    res.status(429).json(errorResponse);
  }
}