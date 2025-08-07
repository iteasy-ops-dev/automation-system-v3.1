  // 헬스 상태 조회 (계약 API 스펙 기반)
  async getDevicesHealth(filters?: {
    groupId?: string;
    status?: string[];
    critical?: boolean;
  }): Promise<{
    summary: {
      total: number;
      online: number;
      offline: number;
      error: number;
      maintenance: number;
    };
    details: DeviceHealthDetail[];
  }> {
    try {
      // 전체 장비 상태 집계
      const statusCounts = await this.prisma.device.groupBy({
        by: ['status'],
        _count: {
          status: true
        },
        where: filters?.groupId ? { groupId: filters.groupId } : undefined
      });

      // 상태별 집계 맵 생성
      const summary = {
        total: 0,
        online: 0,
        offline: 0,
        error: 0,
        maintenance: 0
      };

      // Redis에서 실시간 상태 확인하여 온라인/오프라인 구분
      for (const statusCount of statusCounts) {
        const count = statusCount._count.status;
        summary.total += count;

        switch (statusCount.status) {
          case 'active':
            // active 장비 중 실제 온라인/오프라인 구분 필요
            // 실제 구현에서는 Redis 상태를 확인해야 함
            summary.online += count;
            break;
          case 'inactive':
            summary.offline += count;
            break;
          case 'maintenance':
            summary.maintenance += count;
            break;
          default:
            summary.error += count;
        }
      }

      // 문제가 있는 장비들 상세 조회
      const problemDevices = await this.prisma.device.findMany({
        where: {
          AND: [
            filters?.groupId ? { groupId: filters.groupId } : {},
            filters?.status ? { status: { in: filters.status } } : 
            { status: { in: ['inactive', 'maintenance'] } }
          ]
        },
        select: {
          id: true,
          name: true,
          status: true,
          updatedAt: true
        },
        take: 50 // 최대 50개 문제 장비만 표시
      });

      const details: DeviceHealthDetail[] = problemDevices.map(device => ({
        deviceId: device.id,
        name: device.name,
        status: device.status as 'offline' | 'error' | 'maintenance',
        issue: this.getIssueDescription(device.status),
        lastSeen: device.updatedAt?.toISOString(),
        severity: this.getSeverityForStatus(device.status)
      }));

      return { summary, details };
    } catch (error) {
      this.logger.logError('getDevicesHealth', error as Error, { filters });
      throw error;
    }
  }

  // 장비 그룹별 집계
  async getDevicesByGroup(): Promise<Array<{
    groupId: string | null;
    groupName: string | null;
    count: number;
    devices: Array<{ id: string; name: string; status: string; }>;
  }>> {
    try {
      const devices = await this.prisma.device.findMany({
        select: {
          id: true,
          name: true,
          status: true,
          groupId: true,
          group: {
            select: {
              name: true
            }
          }
        }
      });

      // 그룹별로 분류
      const groupMap = new Map<string | null, {
        groupName: string | null;
        devices: Array<{ id: string; name: string; status: string; }>;
      }>();

      devices.forEach(device => {
        const groupId = device.groupId;
        const groupName = device.group?.name || null;
        
        if (!groupMap.has(groupId)) {
          groupMap.set(groupId, {
            groupName,
            devices: []
          });
        }
        
        groupMap.get(groupId)!.devices.push({
          id: device.id,
          name: device.name,
          status: device.status
        });
      });

      // 결과 변환
      return Array.from(groupMap.entries()).map(([groupId, data]) => ({
        groupId,
        groupName: data.groupName,
        count: data.devices.length,
        devices: data.devices
      }));
    } catch (error) {
      this.logger.logError('getDevicesByGroup', error as Error);
      throw error;
    }
  }
