  // 장비 상세 정보 캐시
  async cacheDeviceDetail(deviceId: string, detail: any, ttlSeconds: number = 120): Promise<boolean> {
    const key = this.keys.detail(deviceId);
    return await this.set(key, JSON.stringify(detail), ttlSeconds);
  }

  async getCachedDeviceDetail(deviceId: string): Promise<any | null> {
    const key = this.keys.detail(deviceId);
    const cached = await this.get(key);
    try {
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      this.logger.error('Parse cached device detail failed', error);
      return null;
    }
  }

  // 메트릭 카운터 (시간별)
  async incrementMetricCounter(deviceId: string, hour: number, count: number = 1): Promise<number> {
    const key = this.keys.metrics(deviceId, hour);
    try {
      const result = await this.redis.incrby(key, count);
      // 6시간 TTL
      await this.redis.expire(key, 21600);
      return result;
    } catch (error) {
      this.logger.error('Increment metric counter failed', error, { deviceId, hour });
      return 0;
    }
  }

  async getMetricCounter(deviceId: string, hour: number): Promise<number> {
    const key = this.keys.metrics(deviceId, hour);
    try {
      const result = await this.redis.get(key);
      return result ? parseInt(result) : 0;
    } catch (error) {
      this.logger.error('Get metric counter failed', error, { deviceId, hour });
      return 0;
    }
  }

  // 유틸리티 메서드
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error('Cache exists check failed', error, { key });
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      return await this.redis.ttl(key);
    } catch (error) {
      this.logger.error('Cache TTL check failed', error, { key });
      return -1;
    }
  }

  // 연결 관리
  async disconnect(): Promise<void> {
    try {
      await this.redis.disconnect();
      this.logger.info('Redis disconnected');
    } catch (error) {
      this.logger.error('Redis disconnect failed', error);
    }
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      this.logger.error('Redis ping failed', error);
      return false;
    }
  }
}
