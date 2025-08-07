  // Device 상태 캐시 (Redis 스키마 기반)
  async setDeviceStatus(
    deviceId: string, 
    status: {
      status: string;
      lastHeartbeat: string;
      cpuUsage?: number;
      memoryUsage?: number;
      diskUsage?: number;
      errorCount?: number;
    },
    ttlSeconds: number = 600 // 10분 TTL
  ): Promise<boolean> {
    const key = this.keys.status(deviceId);
    const pipeline = this.redis.pipeline();
    
    try {
      pipeline.hset(key, 'status', status.status);
      pipeline.hset(key, 'last_heartbeat', status.lastHeartbeat);
      
      if (status.cpuUsage !== undefined) {
        pipeline.hset(key, 'cpu_usage', status.cpuUsage.toString());
      }
      if (status.memoryUsage !== undefined) {
        pipeline.hset(key, 'memory_usage', status.memoryUsage.toString());
      }
      if (status.diskUsage !== undefined) {
        pipeline.hset(key, 'disk_usage', status.diskUsage.toString());
      }
      if (status.errorCount !== undefined) {
        pipeline.hset(key, 'error_count', status.errorCount.toString());
      }
      
      pipeline.expire(key, ttlSeconds);
      
      await pipeline.exec();
      return true;
    } catch (error) {
      this.logger.error('Set device status failed', error, { deviceId });
      return false;
    }
  }

  async getDeviceStatus(deviceId: string): Promise<Record<string, string> | null> {
    const key = this.keys.status(deviceId);
    try {
      const status = await this.hgetall(key);
      return Object.keys(status).length > 0 ? status : null;
    } catch (error) {
      this.logger.error('Get device status failed', error, { deviceId });
      return null;
    }
  }

  // 장비 목록 캐시
  async cacheDeviceList(queryHash: string, devices: any[], ttlSeconds: number = 300): Promise<boolean> {
    const key = this.keys.list(queryHash);
    return await this.set(key, JSON.stringify(devices), ttlSeconds);
  }

  async getCachedDeviceList(queryHash: string): Promise<any[] | null> {
    const key = this.keys.list(queryHash);
    const cached = await this.get(key);
    try {
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      this.logger.error('Parse cached device list failed', error);
      return null;
    }
  }
