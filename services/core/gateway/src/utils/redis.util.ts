import Redis from 'ioredis';
import * as winston from 'winston';
import { config } from '../config/gateway.config';

/**
 * Redis 연결 관리
 */
export class RedisManager {
  private static instance: Redis | null = null;
  private static logger: winston.Logger;

  static setLogger(logger: winston.Logger): void {
    this.logger = logger;
  }

  static async getConnection(): Promise<Redis> {
    if (!this.instance) {
      const redisConfig: any = {
        host: config.redis.host,
        port: config.redis.port,
        db: config.redis.db,
        keyPrefix: config.redis.keyPrefix,
        connectTimeout: config.redis.connectTimeout,
        lazyConnect: config.redis.lazyConnect,
        maxRetriesPerRequest: 3,
      };

      // password가 있는 경우에만 추가
      if (config.redis.password) {
        redisConfig.password = config.redis.password;
      }

      this.instance = new Redis(redisConfig);

      // 이벤트 리스너 등록
      this.instance.on('connect', () => {
        this.logger.info('Redis 연결 성공', { 
          host: config.redis.host, 
          port: config.redis.port,
          db: config.redis.db
        });
      });

      this.instance.on('error', (error) => {
        this.logger.error('Redis 연결 오류', { error });
      });

      this.instance.on('close', () => {
        this.logger.warn('Redis 연결 종료');
      });
    }

    return this.instance;
  }

  static async closeConnection(): Promise<void> {
    if (this.instance) {
      await this.instance.quit();
      this.instance = null;
      this.logger.info('Redis 연결이 종료되었습니다.');
    }
  }
}