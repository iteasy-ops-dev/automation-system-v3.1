/**
 * Rate Limiting 미들웨어
 * Redis 기반 분산 Rate Limiting
 * 
 * 주요 기능:
 * - 사용자별/IP별 요청 제한
 * - 슬라이딩 윈도우 알고리즘
 * - 자동 TTL 관리
 */

import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import winston from 'winston';

import { gatewayConfig } from '../config/gateway.config';
import {
  RateLimitOptions,
  RateLimitError,
  AsyncMiddleware
} from '../types/gateway.types';

export class RateLimitMiddleware {
  private redis: Redis;
  private logger: winston.Logger;

  constructor(redis: Redis, logger: winston.Logger) {
    this.redis = redis;
    this.logger = logger;
  }

  /**
   * 기본 Rate Limiting 미들웨어
   * IP 주소 기반 제한
   */
  basic(options?: Partial<RateLimitOptions>): AsyncMiddleware {
    const config = {
      windowMs: options?.windowMs || gatewayConfig.rateLimit.windowMs,
      maxRequests: options?.maxRequests || gatewayConfig.rateLimit.maxRequests,
      skipSuccessfulRequests: options?.skipSuccessfulRequests || gatewayConfig.rateLimit.skipSuccessfulRequests,
      keyGenerator: options?.keyGenerator || ((req: Request) => req.ip),
      onLimitReached: options?.onLimitReached
    };

    return this.createRateLimiter(config);
  }

  /**
   * 로그인 전용 Rate Limiting 미들웨어
   * 브루트 포스 공격 방지
   */
  loginProtection(): AsyncMiddleware {
    const config = {
      windowMs: 15 * 60 * 1000, // 15분
      maxRequests: 5, // 15분에 5번 시도
      skipSuccessfulRequests: true, // 성공한 요청은 카운트하지 않음
      keyGenerator: (req: Request) => `login:${req.ip}`,
      onLimitReached: (req: Request, res: Response) => {
        this.logger.warn('Login rate limit exceeded', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          body: req.body?.username ? { username: req.body.username } : undefined
        });
      }
    };

    return this.createRateLimiter(config);
  }
  // ========================================
  // Private Helper Methods
  // ========================================

  /**
   * Rate Limiter 생성
   */
  private createRateLimiter(options: RateLimitOptions): AsyncMiddleware {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const key = options.keyGenerator ? options.keyGenerator(req) : req.ip;
        const redisKey = `${gatewayConfig.redis.keyPrefix}ratelimit:${key}`;
        
        // 현재 시간
        const now = Date.now();
        const windowStart = now - options.windowMs;

        // Redis에서 현재 요청 수 확인
        const currentRequests = await this.redis.zcard(redisKey);
        
        if (currentRequests >= options.maxRequests) {
          // Rate limit 초과
          if (options.onLimitReached) {
            options.onLimitReached(req, res);
          }

          this.logger.warn('Rate limit exceeded', {
            key,
            currentRequests,
            maxRequests: options.maxRequests,
            ip: req.ip,
            path: req.path,
            method: req.method
          });

          throw new RateLimitError(
            `Rate limit exceeded. Try again in ${Math.ceil(options.windowMs / 1000)} seconds`,
            {
              limit: options.maxRequests,
              current: currentRequests,
              resetTime: new Date(now + options.windowMs).toISOString()
            }
          );
        }

        // 새 요청 추가
        await this.redis.zadd(redisKey, now, now);
        await this.redis.zremrangebyscore(redisKey, 0, windowStart);
        await this.redis.expire(redisKey, Math.ceil(options.windowMs / 1000));

        // Rate limit 정보를 요청 객체에 추가
        req.rateLimitInfo = {
          limit: options.maxRequests,
          remaining: options.maxRequests - currentRequests - 1,
          resetTime: new Date(now + options.windowMs)
        };

        next();

      } catch (error) {
        if (error instanceof RateLimitError) {
          res.status(429).json({
            error: 'RATE_LIMIT_EXCEEDED',
            message: error.message,
            timestamp: new Date().toISOString(),
            details: error.details
          });
        } else {
          this.logger.error('Rate limiting error', {
            error: error instanceof Error ? error.message : 'Unknown error',
            path: req.path,
            method: req.method,
            ip: req.ip
          });

          // Rate limiting 서비스 오류 시에는 요청을 통과시킴
          next();
        }
      }
    };
  }
}