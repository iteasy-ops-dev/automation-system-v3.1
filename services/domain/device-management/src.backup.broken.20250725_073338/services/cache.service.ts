/**
 * Cache Service - Simplified for DeviceManagementService
 * @file src/services/cache.service.ts
 */

import Redis from 'ioredis';
import { Logger } from '../utils/logger';

export class CacheService {
  private redis: Redis;
  private logger: Logger;
  private isConnected: boolean = false;

  constructor(config: { host: string; port: number; password?: string }) {
    this.logger = new Logger();
    
    this.redis = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      lazyConnect: true,
      maxRetriesPerRequest: 3
    });

    this.setupEventHandlers();
    this.logger.info('Cache service initialized', { host: config.host, port: config.port });
  }

  private setupEventHandlers(): void {
    this.redis.on('connect', () => {
      this.isConnected = true;
      this.logger.info('Redis connected successfully');
    });

    this.redis.on('error', (error) => {
      this.isConnected = false;
      this.logger.error('Redis connection error:', error);
    });

    this.redis.on('close', () => {
      this.isConnected = false;
      this.logger.warn('Redis connection closed');
    });
  }

  async connect(): Promise<void> {
    try {
      await this.redis.connect();
      this.logger.info('Redis connection established');
    } catch (error) {
      this.logger.error('Failed to connect to Redis:', error);
      throw new Error(`Redis connection failed: ${error}`);
    }
  }

  async get<T = any>(key: string): Promise<T | null> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      
      const value = await this.redis.get(key);
      if (value === null) {
        return null;
      }

      try {
        return JSON.parse(value) as T;
      } catch {
        return value as unknown as T;
      }
    } catch (error) {
      this.logger.error('Cache GET error:', { key, error });
      return null;
    }
  }

  async set<T = any>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const serialized = typeof value === 'string' ? value : JSON.stringify(value);

      if (ttl && ttl > 0) {
        await this.redis.setex(key, ttl, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
      
      this.logger.debug('Cache SET', { key, ttl });
    } catch (error) {
      this.logger.error('Cache SET error:', { key, error });
      throw error;
    }
  }

  async del(...keys: string[]): Promise<number> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const result = await this.redis.del(...keys);
      this.logger.debug('Cache DEL', { keys, deleted: result });
      return result;
    } catch (error) {
      this.logger.error('Cache DEL error:', { keys, error });
      return 0;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const keys = await this.redis.keys(pattern);
      return keys;
    } catch (error) {
      this.logger.error('Cache KEYS error:', { pattern, error });
      return [];
    }
  }

  async delPattern(pattern: string): Promise<number> {
    try {
      const keys = await this.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }

      const result = await this.del(...keys);
      this.logger.debug('Pattern delete:', { pattern, deleted: result });
      return result;
    } catch (error) {
      this.logger.error('Pattern delete failed:', { pattern, error });
      return 0;
    }
  }

  async ping(): Promise<boolean> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      this.logger.error('Redis ping failed:', { error });
      return false;
    }
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      const isHealthy = await this.ping();
      
      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        details: {
          connected: this.isConnected,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      this.logger.error('Cache health check failed:', { error });
      return {
        status: 'unhealthy',
        details: {
          connected: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  async close(): Promise<void> {
    try {
      if (this.redis) {
        await this.redis.quit();
        this.isConnected = false;
        this.logger.info('Cache service closed');
      }
    } catch (error) {
      this.logger.error('Error closing cache service:', error);
      this.redis.disconnect();
      this.isConnected = false;
    }
  }
}
