  // Device 상태 변화 기록
  async writeDeviceStatus(
    deviceId: string,
    deviceType: string,
    status: {
      statusCode: number; // 1: online, 0: offline, -1: error, -2: maintenance
      responseTime?: number;
      uptime?: number;
      errorCount?: number;
    },
    tags: Record<string, string> = {},
    timestamp?: Date
  ): Promise<boolean> {
    try {
      const point = new Point('device_status')
        .tag('device_id', deviceId)
        .tag('device_type', deviceType)
        .tag('environment', process.env.NODE_ENV || 'development');

      // 추가 태그 설정
      Object.entries(tags).forEach(([key, value]) => {
        point.tag(key, value);
      });

      // 상태 필드 설정
      point.intField('status_code', status.statusCode);
      
      if (status.responseTime !== undefined) {
        point.floatField('response_time', status.responseTime);
      }
      if (status.uptime !== undefined) {
        point.intField('uptime', status.uptime);
      }
      if (status.errorCount !== undefined) {
        point.intField('error_count', status.errorCount);
      }

      if (timestamp) {
        point.timestamp(timestamp);
      }

      this.writeApi.writePoint(point);
      await this.writeApi.flush();

      return true;
    } catch (error) {
      this.logger.error('Write device status failed', error, { deviceId, deviceType });
      return false;
    }
  }

  // 메트릭 조회 (계약 API 스펙 기반)
  async queryDeviceMetrics(
    deviceId: string,
    metric?: string,
    start?: Date,
    end?: Date,
    interval: string = '5m',
    aggregation: string = 'mean'
  ): Promise<Array<{ timestamp: string; value: number }>> {
    try {
      const startTime = start || new Date(Date.now() - 24 * 60 * 60 * 1000); // 기본 24시간
      const endTime = end || new Date();

      let fieldFilter = '';
      if (metric) {
        const fieldMap: Record<string, string> = {
          'cpu': 'cpu_usage',
          'memory': 'memory_usage',
          'disk': 'disk_usage',
          'network': 'network_in', // 기본값으로 network_in 사용
          'temperature': 'temperature',
          'power': 'power_consumption'
        };
        const field = fieldMap[metric] || metric;
        fieldFilter = `|> filter(fn: (r) => r._field == "${field}")`;
      }

      const fluxQuery = `
        from(bucket: "${this.bucket}")
          |> range(start: ${startTime.toISOString()}, stop: ${endTime.toISOString()})
          |> filter(fn: (r) => r._measurement == "device_metrics")
          |> filter(fn: (r) => r.device_id == "${deviceId}")
          ${fieldFilter}
          |> aggregateWindow(every: ${interval}, fn: ${aggregation}, createEmpty: false)
          |> yield(name: "${aggregation}")
      `;

      const result: Array<{ timestamp: string; value: number }> = [];
      
      return new Promise((resolve, reject) => {
        this.queryApi.queryRows(fluxQuery, {
          next: (row, tableMeta) => {
            const o = tableMeta.toObject(row);
            if (o._value !== undefined && o._time) {
              result.push({
                timestamp: new Date(o._time).toISOString(),
                value: parseFloat(o._value)
              });
            }
          },
          error: (error) => {
            this.logger.error('Query device metrics failed', error, { deviceId, metric });
            reject(error);
          },
          complete: () => {
            resolve(result.sort((a, b) => a.timestamp.localeCompare(b.timestamp)));
          }
        });
      });
    } catch (error) {
      this.logger.error('Query device metrics failed', error, { deviceId, metric });
      return [];
    }
  }
