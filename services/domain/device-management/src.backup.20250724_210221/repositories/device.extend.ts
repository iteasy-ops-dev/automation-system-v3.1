  // 단일 장비 조회 (ID 기반)
  async findDeviceById(id: string): Promise<Device | null> {
    try {
      // 캐시 확인
      const cached = await this.cache.getCachedDeviceDetail(id);
      if (cached) {
        this.logger.debug('Device detail cache hit', { deviceId: id });
        return cached;
      }

      const device = await this.prisma.device.findUnique({
        where: { id },
        include: {
          group: {
            select: {
              id: true,
              name: true,
              description: true
            }
          }
        }
      });

      if (device) {
        // 캐시 저장 (2분 TTL)
        await this.cache.cacheDeviceDetail(id, device, 120);
        this.logger.logDeviceOperation('found', id);
      } else {
        this.logger.debug('Device not found', { deviceId: id });
      }

      return device;
    } catch (error) {
      this.logger.logError('findDeviceById', error as Error, { deviceId: id });
      throw error;
    }
  }

  // 장비명으로 조회
  async findDeviceByName(name: string): Promise<Device | null> {
    try {
      return await this.prisma.device.findUnique({
        where: { name },
        include: {
          group: {
            select: {
              id: true,
              name: true,
              description: true
            }
          }
        }
      });
    } catch (error) {
      this.logger.logError('findDeviceByName', error as Error, { name });
      throw error;
    }
  }

  // 장비 상태 이력 조회
  async getDeviceStatusHistory(
    deviceId: string,
    limit: number = 50
  ): Promise<DeviceStatusHistory[]> {
    try {
      return await this.prisma.deviceStatusHistory.findMany({
        where: { deviceId },
        orderBy: { changedAt: 'desc' },
        take: limit,
        include: {
          changedBy: {
            select: {
              id: true,
              username: true,
              fullName: true
            }
          }
        }
      });
    } catch (error) {
      this.logger.logError('getDeviceStatusHistory', error as Error, { deviceId });
      throw error;
    }
  }

  // 장비 상태 변경 기록
  async recordStatusChange(
    deviceId: string,
    previousStatus: string | null,
    currentStatus: string,
    reason?: string,
    changedBy?: string
  ): Promise<DeviceStatusHistory> {
    try {
      const history = await this.prisma.deviceStatusHistory.create({
        data: {
          deviceId,
          previousStatus,
          currentStatus,
          reason,
          changedBy
        }
      });

      this.logger.logStatusChange(deviceId, previousStatus || 'unknown', currentStatus, reason);
      return history;
    } catch (error) {
      this.logger.logError('recordStatusChange', error as Error, { 
        deviceId, 
        previousStatus, 
        currentStatus 
      });
      throw error;
    }
  }
