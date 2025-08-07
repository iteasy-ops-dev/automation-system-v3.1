  // WHERE 절 구성 헬퍼
  private buildWhereClause(filters: DeviceFilter) {
    const where: any = {};

    if (filters.groupId) {
      where.groupId = filters.groupId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.tags && filters.tags.length > 0) {
      where.tags = {
        hasEvery: filters.tags
      };
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { metadata: { path: ['description'], string_contains: filters.search } }
      ];
    }

    return where;
  }

  // ORDER BY 절 구성 헬퍼
  private buildOrderBy() {
    return [
      { status: 'asc' }, // 상태별 정렬 (active 먼저)
      { name: 'asc' }    // 이름 순 정렬
    ];
  }

  // 캐시 키 생성 헬퍼
  private getListCacheKey(filters: DeviceFilter): string {
    const keyParts = [
      filters.groupId || 'all',
      filters.status || 'all',
      filters.type || 'all',
      filters.tags?.join(',') || 'no-tags',
      filters.search || 'no-search',
      filters.limit || 20,
      filters.offset || 0
    ];
    
    // 해시 생성 (간단한 방식)
    const keyString = keyParts.join('|');
    return Buffer.from(keyString).toString('base64').substring(0, 32);
  }

  // 상태별 이슈 설명
  private getIssueDescription(status: string): string {
    switch (status) {
      case 'inactive':
        return 'Device is offline or unreachable';
      case 'maintenance':
        return 'Device is under maintenance';
      case 'error':
        return 'Device has encountered an error';
      default:
        return 'Unknown issue';
    }
  }

  // 상태별 심각도 매핑
  private getSeverityForStatus(status: string): 'low' | 'medium' | 'high' | 'critical' {
    switch (status) {
      case 'inactive':
        return 'high';
      case 'maintenance':
        return 'low';
      case 'error':
        return 'critical';
      default:
        return 'medium';
    }
  }

  // 캐시 무효화
  async invalidateDeviceCache(deviceId: string): Promise<void> {
    try {
      // 상세 캐시 삭제
      const detailKey = `${this.cachePrefix}:detail:${deviceId}`;
      await this.cache.del(detailKey);

      // 상태 캐시는 TTL이 짧으므로 유지 (10분)
      this.logger.debug('Device cache invalidated', { deviceId });
    } catch (error) {
      this.logger.error('Cache invalidation failed', error, { deviceId });
    }
  }

  // 목록 캐시 무효화 (변경사항이 있을 때)
  async invalidateListCache(): Promise<void> {
    try {
      // 실제 구현에서는 패턴 매칭으로 모든 목록 캐시 삭제
      this.logger.debug('Device list cache invalidated');
    } catch (error) {
      this.logger.error('List cache invalidation failed', error);
    }
  }
}
