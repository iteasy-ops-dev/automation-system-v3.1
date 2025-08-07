  // 기본 캐시 작업
  async get(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch (error) {
      this.logger.error('Cache get failed', error, { key });
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    try {
      if (ttlSeconds) {
        await this.redis.setex(key, ttlSeconds, value);
      } else {
        await this.redis.set(key, value);
      }
      return true;
    } catch (error) {
      this.logger.error('Cache set failed', error, { key, ttlSeconds });
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      const result = await this.redis.del(key);
      return result > 0;
    } catch (error) {
      this.logger.error('Cache delete failed', error, { key });
      return false;
    }
  }

  // Hash 작업 (장비 상태용)
  async hset(key: string, field: string, value: string): Promise<boolean> {
    try {
      await this.redis.hset(key, field, value);
      return true;
    } catch (error) {
      this.logger.error('Cache hset failed', error, { key, field });
      return false;
    }
  }

  async hget(key: string, field: string): Promise<string | null> {
    try {
      return await this.redis.hget(key, field);
    } catch (error) {
      this.logger.error('Cache hget failed', error, { key, field });
      return null;
    }
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    try {
      return await this.redis.hgetall(key);
    } catch (error) {
      this.logger.error('Cache hgetall failed', error, { key });
      return {};
    }
  }
